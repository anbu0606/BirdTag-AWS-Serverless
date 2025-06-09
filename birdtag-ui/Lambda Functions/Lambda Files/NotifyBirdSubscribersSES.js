const AWS = require('aws-sdk');
const ses = new AWS.SES();
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  for (const record of event.Records) {
    // Only handle INSERT and MODIFY events
    if (!['INSERT', 'MODIFY'].includes(record.eventName)) continue;

    // Use NewImage to get the latest tags
    const newItem = record.dynamodb.NewImage;
    const tagList = newItem?.tags?.L;
    const uploadedTags = tagList?.map(tag => tag.S.toLowerCase()) || [];

    console.log(`${record.eventName} event for tags:`, uploadedTags);

    const subs = await docClient.scan({ TableName: 'tag_subscriptions' }).promise();

    for (const user of subs.Items) {
      const email = user.email;
      const userTags = user.tags.split(',').map(t => t.trim().toLowerCase());
      const match = uploadedTags.some(tag => userTags.includes(tag));

      if (match) {
        console.log(`Sending SES email to ${email} for tags ${uploadedTags}`);

        // Prepare subject and body based on event type
        let subject = '';
        let bodyText = '';

        if (record.eventName === 'INSERT') {
          subject = `New Bird Entry: ${uploadedTags.join(', ')}`;
          bodyText = `Hi,\nA new bird entry was uploaded with the following tag(s): ${uploadedTags.join(', ')}.`;
        } else if (record.eventName === 'MODIFY') {
          subject = `Updated Bird Entry: ${uploadedTags.join(', ')}`;
          bodyText = `Hi,\nA bird entry was modified with the following tag(s): ${uploadedTags.join(', ')}.`;
        }

        const params = {
          Source: 'sahanasukumar8@gmail.com',
          Destination: {
            ToAddresses: [email]
          },
          Message: {
            Subject: {
              Data: subject
            },
            Body: {
              Text: {
                Data: bodyText
              }
            }
          }
        };

        await ses.sendEmail(params).promise();
      } else {
        console.log(`No tag match for ${email}, skipping.`);
      }
    }
  }

  return { statusCode: 200 };
};
