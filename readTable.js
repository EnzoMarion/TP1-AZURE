const { TableClient } = require('@azure/data-tables');

async function main() {
    const client = TableClient.fromConnectionString("UseDevelopmentStorage=true", "OrdersTable");
    console.log("\n--- CONTENU DE LA TABLE OrdersTable DANS AZURITE ---");
    
    const entities = client.listEntities();
    let count = 0;
    for await (const entity of entities) {
        count++;
        console.log(`[Ligne ${count}] PartitionKey: ${entity.partitionKey} | RowKey: ${entity.rowKey}`);
        console.log(`         Produit: ${entity.produit} | Prix: ${entity.prix}€ | Traité le: ${entity.processedAt}\n`);
    }

    if (count === 0) {
        console.log("La table est vide pour le moment.");
    }
}

main().catch(console.error);