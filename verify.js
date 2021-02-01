const AWS = require('aws-sdk');

const docClient = new AWS.DynamoDB.DocumentClient({
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
});

async function listItems(TableName = 'to-be-renamed') {
  const res = await docClient
    .scan({
      TableName,
    })
    .promise();
  return res.Items;
}

async function verify() {
  console.log('old-table', await listItems());
  console.log('after-rename', await listItems('after-rename'));
}

verify();
