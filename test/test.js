'use strict';

const AdminConnection = require('composer-admin').AdminConnection;
const BrowserFS = require('browserfs/dist/node/index');
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const path = require('path');

// Configuring chai testing
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const assert = chai.assert
const expect = chai.expect

const bfs_fs = BrowserFS.BFSRequire('fs');
const NS = 'org.riksbanken.ekrona';

describe('e-krona', () => {
  let businessNetworkConnection;
  let factory
  let assetRegistry
  let participantRegistry
  let events

  let aliceIdentity
  const aliceId = '1212121212'
  let bobIdentity
  const bobId = '1111111111'
  let svdIdentity
  const svdId = '1010101010'

  /**
   * Reconnect using a different identity.
   * @param {Object} identity The identity to use.
   * @return {Promise} A promise that will be resolved when complete.
   */
  function useIdentity(identity) {
    return businessNetworkConnection.disconnect()
      .then(() => {
        businessNetworkConnection = new BusinessNetworkConnection({ fs: bfs_fs });
        events = [];
        businessNetworkConnection.on('event', (event) => {
          events.push(event);
        });
        return businessNetworkConnection.connect('defaultProfile', 'ekrona-network', identity.userID, identity.userSecret);
      });
  }

  before(() => {
    // Initialize an in-memory file system, so we do not write any files to the actual file system.
    BrowserFS.initialize(new BrowserFS.FileSystem.InMemory());

    // Create a new admin connection.
    const adminConnection = new AdminConnection({ fs: bfs_fs });

    // Create a new connection profile that uses the embedded (in-memory) runtime.
    return adminConnection.createProfile('defaultProfile', { type: 'embedded' })
      .then(() => {

        // Establish an admin connection. The user ID must be admin. The user secret is
        // ignored, but only when the tests are executed using the embedded (in-memory)
        // runtime.
        return adminConnection.connect('defaultProfile', 'admin', 'adminpw');
      })
      .then(() => {
        // Generate a business network definition from the project directory.
        return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
      })
      .then((businessNetworkDefinition) => {
        // Deploy and start the business network defined by the business network definition.
        return adminConnection.deploy(businessNetworkDefinition);
      })
      .then(() => {
        // Create and establish a business network connection
        businessNetworkConnection = new BusinessNetworkConnection({ fs: bfs_fs });
        events = [];
        businessNetworkConnection.on('event', (event) => {
          events.push(event);
        });
        return businessNetworkConnection.connect('defaultProfile', 'ekrona-network', 'admin', 'adminpw');
      })
      .then(() => {
        // Get the factory for the business network.
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();
      })
      .then(() => businessNetworkConnection.getParticipantRegistry(`${NS}.Person`)
        .then(registry => participantRegistry = registry))
      .then(() => businessNetworkConnection.getAssetRegistry(`${NS}.Account`)
        .then(registry => assetRegistry = registry))
      .then(() => {

        // Create seed participants.
        const alice = factory.newResource(NS, 'Person', aliceId);
        alice.firstName = 'Alice';
        alice.lastName = 'A';
        const bob = factory.newResource(NS, 'Person', bobId);
        bob.firstName = 'Bob';
        bob.lastName = 'B';

        const svd = factory.newResource(NS, 'Person', svdId);
        svd.firstName = 'Svenska';
        svd.lastName = 'Dagbladet';

        // Create seed assets.
        const asset1 = factory.newResource(NS, 'Account', '1');
        asset1.owner = factory.newRelationship(NS, 'Person', aliceId);
        asset1.value = 100;
        const asset2 = factory.newResource(NS, 'Account', '2');
        asset2.owner = factory.newRelationship(NS, 'Person', bobId);
        asset2.value = 200;
        const asset3 = factory.newResource(NS, 'Account', '3');
        asset3.owner = factory.newRelationship(NS, 'Person', svdId);
        asset3.value = 200;

        // Save seeds
        return Promise.all([
          participantRegistry.addAll([alice, bob, svd]),
          assetRegistry.addAll([asset1, asset2, asset3])
        ])
      })
      .then(() => businessNetworkConnection.issueIdentity(`${NS}.Person#${aliceId}`, 'alice')
        .then(identity => aliceIdentity = identity))
      .then(() => businessNetworkConnection.issueIdentity(`${NS}.Person#${bobId}`, 'bob')
        .then(identity => bobIdentity = identity))
      .then(() => businessNetworkConnection.issueIdentity(`${NS}.Person#${svdId}`, 'svd')
        .then(identity => svdIdentity = identity))
  });

  describe('#transactions', () => {
    it('Alice can buy from Svd', () => {
      const tx = factory.newTransaction(NS, 'AccountTransaction')
      tx.from = factory.newRelationship(NS, 'Account', '1') // Alice's account
      tx.to = factory.newRelationship(NS, 'Account', '3') // SvD's account
      tx.amount = 4
      
      return useIdentity(aliceIdentity)
        .then(() => {
          return businessNetworkConnection.submitTransaction(tx)
        })
        .then(() => {
          // Get SvD's account.
          return assetRegistry.get('3')
        })
        .then(a => {
          // Verify that SvD now has initial amount (200) + the 4 from Alice.
          expect(a.value).to.eql(200 + 4)
        })
    })

    describe('AccountTransaction constraints', () => {
      it('It is not possible to submit a transaction without "from"', () => {
        return useIdentity(aliceIdentity)
          .then(() => {
            let tx = factory.newTransaction(NS, 'AccountTransaction')
            tx.amount = 0
            tx.to = factory.newRelationship(NS, 'Account', '2')
            return businessNetworkConnection.submitTransaction(tx)
          })
          .catch(e => {
            expect(e.message.indexOf('missing required field from')).to.be.greaterThan(-1)
          })
      })
  
      it('It is not possible to submit a transaction without "to"', () => {
        return useIdentity(aliceIdentity)
          .then(() => {
            let tx = factory.newTransaction(NS, 'AccountTransaction')
            tx.amount = 0
            tx.from = factory.newRelationship(NS, 'Account', '1')
            return businessNetworkConnection.submitTransaction(tx)
          })
          .catch(e => {
            expect(e.message.indexOf('missing required field to')).to.be.greaterThan(-1)
          })
      })

      it('It is not possible to submit a transaction without "amount"', () => {
        return useIdentity(aliceIdentity)
          .then(() => {
            let tx = factory.newTransaction(NS, 'AccountTransaction')
            tx.to = factory.newRelationship(NS, 'Account', '2')
            tx.from = factory.newRelationship(NS, 'Account', '1')
            return businessNetworkConnection.submitTransaction(tx)
          })
          .catch(e => {
            expect(e.message.indexOf('missing required field amount')).to.be.greaterThan(-1)
          })
      })

      it('It is not possible to submit a transaction having amount 0', () => {
        const tx = factory.newTransaction(NS, 'AccountTransaction')
        tx.from = factory.newRelationship(NS, 'Account', '1') // Alice's account
        tx.to = factory.newRelationship(NS, 'Account', '2') // SvD's account
        tx.amount = 0

        return useIdentity(aliceIdentity)
          .then(() => {
            return businessNetworkConnection.submitTransaction(tx)
          })
          .catch(e => {
            expect(e.message.indexOf("does not have 'CREATE' access to resource")).to.be.greaterThan(-1)
          })
      })
    })
  })
});