const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();
const topicArn = process.env.SNS_TOPIC_ARN;

exports.handler = async (event) => {
  try {
    const { fileName, contentType } = JSON.parse(event.body);

    const allowedTypes = ['image', 'video', 'audio'];
    const type = contentType.split('/')[0];

    if (!allowedTypes.includes(type)) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Only image, video, or audio files are allowed.' }),
      };
    }

    const bucketName = 'g116-media-s3';
    const key = `${type}/${fileName}`;

    try {
      await s3.headObject({ Bucket: bucketName, Key: key }).promise();
      return {
        statusCode: 409,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'A file with the same name already exists.' }),
      };
    } catch (err) {
      if (err.code !== 'NotFound') throw err;
    }

    const url = s3.getSignedUrl('putObject', {
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      Expires: 300,
    });

    const speciesTag = fileName.split('_')[0].toLowerCase(); 

    const params = {
      TableName: 'tag_subscriptions',
      IndexName: 'tag-index',
      KeyConditionExpression: 'tag = :tag',
      ExpressionAttributeValues: {
        ':tag': speciesTag
      }
    };

    const result = await dynamoDB.query(params).promise();
    if (result.Items.length > 0) {
      await sns.publish({
        TopicArn: topicArn,
        Subject: `New ${speciesTag} Upload`,
        Message: `A new ${type} file tagged with "${speciesTag}" has been uploaded.`,
      }).promise();
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
      },
      body: JSON.stringify({ url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};