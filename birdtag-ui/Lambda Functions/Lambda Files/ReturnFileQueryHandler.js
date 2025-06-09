const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: 'ap-southeast-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    console.log("Received event from another Lambda:", JSON.stringify(event, null, 2));
    
    // Extract fields from the payload
    let inputTags = [];
    let inputCounts = [];
    
    // Handle different event formats
    if (event.tags) {
      inputTags = event.tags;
      inputCounts = event.counts || [];
    } else if (event.body) {
      // Handle API Gateway format where data is in body
      const bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      inputTags = bodyData.tags || [];
      inputCounts = bodyData.counts || [];
    } else {
      inputTags = [];
      inputCounts = [];
    }
    
    console.log(`Input tags: ${JSON.stringify(inputTags)}, counts: ${JSON.stringify(inputCounts)}`);
    
    // Validate input
    if (!Array.isArray(inputTags) || inputTags.length === 0) {
      console.log("No valid tags provided, returning error");
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          message: "No tags provided for file query",
          tags: inputTags,
          counts: inputCounts,
          results: [],
          totalCount: 0
        })
      };
    }
    
    console.log(`Searching for files with tags: ${JSON.stringify(inputTags)} and counts: ${JSON.stringify(inputCounts)}`);
    
    // Query birds_table to find matching files
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
    console.log(`Found ${result.Items.length} total files in database`);
    
    // Debug: Log the first item to see the data structure
    if (result.Items.length > 0) {
      console.log('Sample item structure:', JSON.stringify(result.Items[0], null, 2));
    }
    
    // Convert input tags to lowercase for comparison
    const searchTags = inputTags.map(tag => tag.toLowerCase().trim());
    console.log('Normalized search tags:', searchTags);
    
    // Filter results to find files that contain ANY of the input tags
    const matchingFiles = result.Items.filter(file => {
      // Extract bird species from tags field
      let fileSpecies = [];
      if (Array.isArray(file.tags)) {
        fileSpecies = file.tags.map(tag => tag.toLowerCase().trim());
      } else if (typeof file.tags === 'string') {
        fileSpecies = [file.tags.toLowerCase().trim()];
      } else if (file.tags && file.tags.S) {
        // Handle DynamoDB String format
        fileSpecies = [file.tags.S.toLowerCase().trim()];
      }
      
      // Get file counts
      let fileCounts = [];
      if (Array.isArray(file.counts)) {
        fileCounts = file.counts.map(count => parseInt(count) || 0);
      } else if (typeof file.counts === 'number') {
        fileCounts = [file.counts];
      } else if (file.counts && file.counts.N) {
        // Handle DynamoDB Number format
        fileCounts = [parseInt(file.counts.N) || 0];
      }
      
      console.log(`File ${file.id}: species=${JSON.stringify(fileSpecies)}, counts=${JSON.stringify(fileCounts)}`);
      
      // Check if file contains ANY of the search tags (OR logic)
      let hasMatchingTag = false;
      for (let i = 0; i < searchTags.length; i++) {
        const searchTag = searchTags[i];
        const searchCount = inputCounts[i] || 1; // Default minimum count to 1
        
        // Find if this search tag exists in the file's tags
        const tagIndex = fileSpecies.indexOf(searchTag);
        if (tagIndex !== -1) {
          // Tag found, check count requirement if provided
          const fileCount = fileCounts[tagIndex] || fileCounts[0] || 0;
          console.log(`Found tag "${searchTag}" at index ${tagIndex}, file count: ${fileCount}, required: ${searchCount}`);
          
          if (fileCount >= searchCount) {
            hasMatchingTag = true;
            console.log(`✓ Tag "${searchTag}" meets count requirement`);
            break; // Found at least one matching tag, that's enough for OR logic
          }
        }
      }
      
      if (hasMatchingTag) {
        console.log(`✓ File ${file.id} matches criteria`);
      } else {
        console.log(`✗ File ${file.id} does not match criteria`);
      }
      
      return hasMatchingTag;
    });

    console.log(`Found ${matchingFiles.length} matching files after filtering`);

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

    // Format response URLs according to file type
    const links = matchingFiles.map(file => {
      if (file.file_type === 'image') {
        // Return thumbnail URL for images, fallback to full URL
        const thumbnailUrl = fixS3Url(file.s3_thumbnail_url);
        const fullUrl = fixS3Url(file.s3_url);
        return thumbnailUrl || fullUrl;
      } else {
        // Return full URL for videos and audio files
        return fixS3Url(file.s3_url);
      }
    });

    // Include detailed metadata for each matching file
    const results = matchingFiles.map(file => {
      // Parse detected birds information from arrays or single values
      let detectedBirds = {};
      
      if (Array.isArray(file.tags) && Array.isArray(file.counts)) {
        // Map each species to its count
        file.tags.forEach((species, index) => {
          if (species && file.counts[index] !== undefined) {
            detectedBirds[species.toLowerCase()] = parseInt(file.counts[index]) || 0;
          }
        });
      } else if (file.tags && file.counts) {
        // Handle single tag/count case or DynamoDB format
        let species = '';
        let count = 0;
        
        if (file.tags.S) {
          species = file.tags.S;
        } else if (typeof file.tags === 'string') {
          species = file.tags;
        } else if (Array.isArray(file.tags)) {
          species = file.tags[0];
        }
        
        if (file.counts.N) {
          count = parseInt(file.counts.N) || 0;
        } else if (typeof file.counts === 'number') {
          count = file.counts;
        } else if (Array.isArray(file.counts)) {
          count = file.counts[0] || 0;
        }
        
        if (species) {
          detectedBirds[species.toLowerCase()] = count;
        }
      }
      
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

    // Return properly formatted Lambda proxy response
    const responseBody = {
      message: `Found ${matchingFiles.length} files containing the specified bird species`,
      searchTags: inputTags,
      searchCounts: inputCounts,
      links: links,
      results: results,
      totalCount: matchingFiles.length,
      summary: {
        totalFilesScanned: result.Items.length,
        matchingFiles: matchingFiles.length,
        imageCount: results.filter(r => r.fileType === 'image').length,
        videoCount: results.filter(r => r.fileType === 'video').length,
        audioCount: results.filter(r => r.fileType === 'audio').length
      }
    };

    console.log("Response summary:", {
      totalCount: responseBody.totalCount,
      linksGenerated: responseBody.links.length,
      searchTags: responseBody.searchTags
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(responseBody)
    };

  } catch (error) {
    console.error("Error processing file query:", error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: "Error processing file query",
        error: error.message,
        tags: event.tags || [],
        counts: event.counts || [],
        results: [],
        totalCount: 0
      })
    };
  }
};