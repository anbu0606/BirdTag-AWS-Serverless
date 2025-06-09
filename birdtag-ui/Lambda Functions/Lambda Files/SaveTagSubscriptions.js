const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  try {
    let body;

    // Safely parse event.body
    if (event.body) {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    }else if (event.email && event.tags) {
      body = event
    } else {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing request body.' })
      };
    }

    const email = body.email;
    const tags = body.tags;

    if (!email || !tags || !Array.isArray(tags)) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Email and tags are required.' })
      };
    }

    const params = {
      TableName: 'tag_subscriptions',
      Item: {
        email: email,
        tags: tags.join(',')
      }
    };

    console.log("Received subscription request:");
    console.log("User email:", email);
    console.log("Selected tags:", tags);

    await docClient.put(params).promise();

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Subscription saved successfully.' })
    };

  } catch (err) {
    console.error('Error saving subscription:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal server error.' })
    };
  }
};
