

/**
 * Sample transaction processor function.
 * @param {org.riksbanken.ekrona.AccountTransaction} tx The sample transaction instance.
 * @transaction
 */

function sampleTransaction(tx) {

    // Save the old value of the asset.
    var fromBefore = tx.from.value;
    var toBefore = tx.to.value;

    // Update the asset with the new value.
    tx.from.value = tx.from.value - tx.amount;
    tx.to.value = tx.to.value + tx.amount;

    // Get the asset registry for the asset.
    return getAssetRegistry('org.riksbanken.ekrona.Account')
        .then(function (assetRegistry) {
            // Update the assets in the asset registry.
            Promise.all([assetRegistry.update(tx.from), assetRegistry.update(tx.to)]);
        })
        .then(function () {

            // Emit an event for the from asset.
            var event = getFactory().newEvent('org.riksbanken.ekrona', 'AccountValueChangeEvent');
            event.account = tx.from;
            event.oldValue = fromBefore;
            event.newValue = tx.from.value;
            emit(event);

        })
        .then(function () {

            // Emit an event for the to asset.
            var event = getFactory().newEvent('org.riksbanken.ekrona', 'AccountValueChangeEvent');
            event.account = tx.to;
            event.oldValue = toBefore;
            event.newValue = tx.to.value;
            emit(event);

        });

}
