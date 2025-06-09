const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: 'ap-southeast-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    let searchCriteria = {};
    
    // Handle only POST requests
    if (event.httpMethod === 'POST') {
      // Parse JSON body: {"crow": 3, "pigeon": 2}
      const body = JSON.parse(event.body || '{}');
      searchCriteria = Object.keys(body).reduce((acc, key) => {
        const count = parseInt(body[key]);
        if (!isNaN(count) && count > 0) {
          acc[key.toLowerCase().trim()] = count;
        }
        return acc;
      }, {});
    } else {
      // Method not allowed
      return {
        statusCode: 405,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ 
          error: 'Method not allowed. Only POST requests are supported.' 
        }),
      };
    }

    // Validate search criteria
    if (Object.keys(searchCriteria).length === 0) {
      return {
        statusCode: 400,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ 
          error: 'No valid search criteria provided. Use POST request with JSON body ({"crow": 1}).' 
        }),
      };
    }

    // Query your birds_table - get image, video, and audio files
    const scanParams = {
      TableName: 'birds_table',
      FilterExpression: 'attribute_exists(tags) AND (file_type = :imageType OR file_type = :videoType OR file_type = :audioType)',
      ExpressionAttributeValues: {
        ':imageType': 'image',
        ':videoType': 'video',
        ':audioType': 'audio'
      }
    };

    console.log('Scanning DynamoDB with params:', JSON.stringify(scanParams));
    const command = new ScanCommand(scanParams);
    const result = await dynamodb.send(command);
    console.log(`Found ${result.Items.length} files in database`);
    
    // Debug: Log the first item to see the data structure
    if (result.Items.length > 0) {
      console.log('Sample item structure:', JSON.stringify(result.Items[0], null, 2));
    }
    
    // Filter results based on search criteria (OR logic - matches any species)
    const matchingFiles = result.Items.filter(file => {
      // Extract bird species from tags field (it's an array)
      let fileSpecies = [];
      if (Array.isArray(file.tags)) {
        fileSpecies = file.tags.map(tag => tag.toLowerCase());
      } else if (typeof file.tags === 'string') {
        fileSpecies = [file.tags.toLowerCase()];
      }
      
      // Get file counts (it's an array)
      let fileCounts = [];
      if (Array.isArray(file.counts)) {
        fileCounts = file.counts.map(count => parseInt(count));
      } else if (typeof file.counts === 'number') {
        fileCounts = [file.counts];
      }
      
      console.log(`File ${file.id}: species=${JSON.stringify(fileSpecies)}, counts=${JSON.stringify(fileCounts)}`);
      
      // Check if file matches any search criteria (OR logic)
      for (const [species, minCount] of Object.entries(searchCriteria)) {
        const speciesLower = species.toLowerCase();
        
        // Find the index of the species in the tags array
        const speciesIndex = fileSpecies.indexOf(speciesLower);
        
        if (speciesIndex !== -1) {
          // Species found, check if we have a corresponding count
          const fileCount = fileCounts[speciesIndex] || 0;
          console.log(`Checking: species "${speciesLower}" found at index ${speciesIndex}, count ${fileCount} vs min ${minCount}`);
          
          if (fileCount >= minCount) {
            console.log('✓ Match found!');
            return true; // File matches at least one criteria
          }
        }
      }
      console.log('✗ No match');
      return false;
    });

    console.log(`Found ${matchingFiles.length} matching files after filtering`);

    // Format response according to file type
    const links = matchingFiles.map(file => {
      if (file.file_type === 'image') {
        // Return thumbnail URL for images
        return file.s3_thumbnail_url || file.s3_url;
      } else {
        // Return full URL for videos and audio files
        return file.s3_url;
      }
    });

    // Include detailed metadata for frontend processing
    const results = matchingFiles.map(file => {
      // Parse detected birds information from arrays
      let detectedBirds = {};
      
      if (Array.isArray(file.tags) && Array.isArray(file.counts)) {
        // Map each species to its count
        file.tags.forEach((species, index) => {
          if (species && file.counts[index] !== undefined) {
            detectedBirds[species.toLowerCase()] = file.counts[index];
          }
        });
      }
      
      // Fix S3 URLs - convert s3:// to https://
      const fixS3Url = (url) => {
        if (!url) return url;
        if (url.startsWith('s3://')) {
          // Convert s3://bucket-name/path to https://bucket-name.s3.region.amazonaws.com/path
          const s3Match = url.match(/^s3:\/\/([^\/]+)\/(.+)$/);
          if (s3Match) {
            const bucketName = s3Match[1];
            const objectKey = s3Match[2];
            return `https://${bucketName}.s3.ap-southeast-2.amazonaws.com/${objectKey}`;
          }
        }
        return url;
      };
      
      const thumbnailUrl = fixS3Url(file.s3_thumbnail_url);
      const fullUrl = fixS3Url(file.s3_url);
      
      return {
        url: file.file_type === 'image' ? (thumbnailUrl || fullUrl) : fullUrl,
        fullUrl: fullUrl,
        fileName: file.file_name,
        fileType: file.file_type,
        detectedBirds: detectedBirds,
        uploadDate: file.timestamp,
        fileId: file.id
      };
    });

    return {
      statusCode: 200,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        links: links,
        results: results,
        totalCount: links.length,
        searchCriteria: searchCriteria,
        message: `Found ${links.length} files matching your criteria`
      }),
    };

  } catch (error) {
    console.error('Search error:', error);
    return {
      statusCode: 500,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        error: 'Internal server error during search',
        details: error.message 
      }),
    };
  }
};