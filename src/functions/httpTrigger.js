const { app, output } = require('@azure/functions');

const queueOutput = output.storageQueue({
    queueName: 'orders',
    connection: 'AzureWebJobsStorage'
});

app.http('httpTrigger', {
    methods: ['POST'],
    authLevel: 'anonymous',
    extraOutputs: [queueOutput],
    handler: async (request, context) => {
        context.log(`HTTP Trigger déclenché : ${request.url}`);

        try {
            const body = await request.json();

            if (!body || Object.keys(body).length === 0) {
                return { status: 400, body: "Le corps de la requête JSON ne doit pas être vide." };
            }

            context.extraOutputs.set(queueOutput, body);

            return {
                status: 202,
                jsonBody: {
                    message: "Message déposé dans la file via Binding avec succès.",
                    data: body
                }
            };
        } catch (error) {
            context.error("Erreur HTTP Trigger :", error);
            return { status: 500, body: "Erreur lors du traitement de la requête." };
        }
    }
});