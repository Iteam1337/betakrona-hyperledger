
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

        // Create seed assets.
        const asset1 = factory.newResource(NS, 'Account', '1');
        asset1.owner = factory.newRelationship(NS, 'Person', '1212121212');
        asset1.value = 100;
        const asset2 = factory.newResource(NS, 'Account', '2');
        asset2.owner = factory.newRelationship(NS, 'Person', '1111111111');
        asset2.value = 200;

        // Save seeds
        return Promise.all([
          participantRegistry.addAll([alice, bob]),
          assetRegistry.addAll([asset1, asset2])
        ])
      })
      .then(() => businessNetworkConnection.issueIdentity(`${NS}.Person#${aliceId}`, 'alice')
        .then(identity => aliceIdentity = identity))
      .then(() => businessNetworkConnection.issueIdentity(`${NS}.Person#${bobId}`, 'bob')
        .then(identity => bobIdentity = identity))
  });

  describe('#transactions', () => {

    it('should pass', () => {
      assert(true)
    })

    it('Alice can submit CreateEmptyAccount transaction', () => {
      const tx = factory.newTransaction(NS, 'CreateEmptyAccount')
      tx.accountId = '9132124512'

      return useIdentity(aliceIdentity)
        .then(() => businessNetworkConnection.submitTransaction(tx))
        .then(() => assetRegistry.exists('9132124512')
          .then(x => assert(x === true)))
    })
  })
});
