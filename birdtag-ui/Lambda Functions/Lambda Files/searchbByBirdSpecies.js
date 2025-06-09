const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB();

exports.handler = async (event) => {
  try {
    console.log("Incoming event:", JSON.stringify(event));

    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body || event;
    }

    const tags = body.tags;

    if (!Array.isArray(tags) || tags.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: "Missing or invalid 'tags' array in body." }),
      };
    }

    const scanParams = {
      TableName: 'birds_table',
    };

    const data = await dynamo.scan(scanParams).promise();

    const results = data.Items.filter((item) => {
      const fileTags = (item.tags.L || []).map(tagObj => tagObj.S);
      return tags.some(tag => fileTags.includes(tag));  // OR logic
    });

    const links = results.map(item => {
      const type = item.file_type.S;
      if (type === 'image') {
        return {
          type: 'image',
          thumb: item.s3_thumbnail_url?.S || item.s3_url.S,
          full: item.s3_url.S
        };
      } else if (type === 'video') {
        return {
          type: 'video',
          url: item.s3_url.S
        };
      } else {
        return null; // skip unsupported types like audio for now
      }
    }).filter(Boolean); // remove nulls

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ links }),
    };

  } catch (err) {
    console.error("Lambda error:", err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || 'Unknown server error' }),
    };
  }
};