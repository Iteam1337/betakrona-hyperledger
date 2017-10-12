
'use strict';

const AdminConnection = require('composer-admin').AdminConnection;
const BrowserFS = require('browserfs/dist/node/index');
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const path = require('path');

require('chai').should();

const bfs_fs = BrowserFS.BFSRequire('fs');
const NS = 'org.riksbanken.ekrona';

describe('e-krona', () => {


    let businessNetworkConnection;
    let factory
    let events

    let aliceIdentity
    const aliceId ='1212121212'
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

                // Create the participants.
                const alice = factory.newResource(NS, 'Person', aliceId);
                alice.firstName = 'Alice';
                alice.lastName = 'A';
                const bob = factory.newResource(NS, 'Person', bobId);
                bob.firstName = 'Bob';
                bob.lastName = 'B';
                return businessNetworkConnection.getParticipantRegistry(`${NS}.Person`)
                    .then((participantRegistry) => {
                        participantRegistry.addAll([alice, bob]);
                    });

            })
            .then(() => {

                // Create the assets.
                const asset1 = factory.newResource(NS, 'Account', '1');
                asset1.owner = factory.newRelationship(NS, 'Person', '1212121212');
                asset1.value = 100;
                const asset2 = factory.newResource(NS, 'Account', '2');
                asset2.owner = factory.newRelationship(NS, 'Person', '1111111111');
                asset2.value = 200;
                return businessNetworkConnection.getAssetRegistry(`${NS}.Account`)
                    .then((assetRegistry) => {
                        assetRegistry.addAll([asset1, asset2]);
                    });
            })
            .then(() => {

                // Issue the identities.
                return businessNetworkConnection.issueIdentity(`${NS}.Person#${aliceId}`, 'alice')
                    .then((identity) => {
                        aliceIdentity = identity;
                        return businessNetworkConnection.issueIdentity(`${NS}.Person#${bobId}`, 'bob');
                    })
                    .then((identity) => {
                        bobIdentity = identity;
                    });

            });;
    });

    describe('#transactions', () => {

        it('should pass', () => {
            true.should.equal(true)
        })

        it('Alice can create a new account', () => {
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory()

            const alice = factory.newResource(NS, 'Person', '121212')
            alice.firstName = "Alice"
            alice.lastName = ""

            const tx = factory.newTransaction(NS, 'CreateEmptyAccount')


            return businessNetworkConnection.submitTransaction(tx).then(x => {
                console.log('x', x)
                //true.should.equal(false)
            }).catch(y => console.log('y', y))

        })

        /* it('should be able to trade a commodity', () => {
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // create the traders
            const dan = factory.newResource(NS, 'Trader', 'dan@email.com');
            dan.firstName = 'Dan';
            dan.lastName = 'Selman';

            const simon = factory.newResource(NS, 'Trader', 'simon@email.com');
            simon.firstName = 'Simon';
            simon.lastName = 'Stone';

            // create the commodity
            const commodity = factory.newResource(NS, 'Commodity', 'EMA');
            commodity.description = 'Corn';
            commodity.mainExchange = 'Euronext';
            commodity.quantity = 100;
            commodity.owner = factory.newRelationship(NS, 'Trader', dan.$identifier);

            // create the trade transaction
            const trade = factory.newTransaction(NS, 'Trade');
            trade.newOwner = factory.newRelationship(NS, 'Trader', simon.$identifier);
            trade.commodity = factory.newRelationship(NS, 'Commodity', commodity.$identifier);

            // the owner should of the commodity should be dan
            commodity.owner.$identifier.should.equal(dan.$identifier);

            // Get the asset registry.
            let commodityRegistry;
            return businessNetworkConnection.getAssetRegistry(NS + '.Commodity')
                .then((assetRegistry) => {
                    commodityRegistry = assetRegistry;
                    // add the commodity to the asset registry.
                    return commodityRegistry.add(commodity);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(NS + '.Trader');
                })
                .then((participantRegistry) => {
                    // add the traders
                    return participantRegistry.addAll([dan, simon]);
                })
                .then(() => {
                    // submit the transaction
                    return businessNetworkConnection.submitTransaction(trade);
                })
                .then(() => {
                    // re-get the commodity
                    return commodityRegistry.get(commodity.$identifier);
                })
                .then((newCommodity) => {
                    // the owner of the commodity should now be simon
                    newCommodity.owner.$identifier.should.equal(simon.$identifier);
                });
        }); */
    });
});