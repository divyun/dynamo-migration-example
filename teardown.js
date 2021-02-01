const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB({
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
});

async function deleteTables() {
  await dynamo.deleteTable({ TableName: 'to-be-renamed' }).promise();

  await dynamo.deleteTable({ TableName: 'after-rename' }).promise();

  await dynamo.deleteTable({ TableName: 'migrations' }).promise();

  const res = await dynamo.listTables().promise();

  console.log(res);
}

async function teardown() {
  await deleteTables();
}

teardown();