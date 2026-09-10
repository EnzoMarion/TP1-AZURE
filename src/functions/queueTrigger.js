const { app, output } = require('@azure/functions');
const { randomUUID } = require('crypto');

const tableOutput = output.table({
    tableName: 'OrdersTable',
    connection: 'AzureWebJobsStorage'
});

app.storageQueue('queueTrigger', {
    queueName: 'orders',
    connection: 'AzureWebJobsStorage',
    extraOutputs: [tableOutput],
    handler: async (queueItem, context) => {
        context.log("Queue Trigger déclenché par un message :", queueItem);

        let data = queueItem;
        if (typeof queueItem === 'string') {
            try {
                data = JSON.parse(queueItem);
            } catch {
                data = { raw: queueItem };
            }
        }

        const entity = {
            partitionKey: data.category || "General",
            rowKey: data.id || randomUUID(),
            ...data,
            processedAt: new Date().toISOString()
        };

        context.extraOutputs.set(tableOutput, entity);
        context.log(`Entité transmise au binding Table Storage (RowKey: ${entity.rowKey})`);
    }
});