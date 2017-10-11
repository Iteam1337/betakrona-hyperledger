/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

    // let adminConnection;
    let businessNetworkConnection;

    before(() => {
        BrowserFS.initialize(new BrowserFS.FileSystem.InMemory());
        const adminConnection = new AdminConnection({ fs: bfs_fs });
        return adminConnection.createProfile('defaultProfile', {
            type: 'embedded'
        })
            .then(() => {
                return adminConnection.connect('defaultProfile', 'admin', 'adminpw');
            })
            .then(() => {
                return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
            })
            .then((businessNetworkDefinition) => {
                return adminConnection.deploy(businessNetworkDefinition);
            })
            .then(() => {
                businessNetworkConnection = new BusinessNetworkConnection({ fs: bfs_fs });
                return businessNetworkConnection.connect('defaultProfile', 'ekrona-network', 'admin', 'adminpw');
            });
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
            }).catch(y => console.log('y',y))
            
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