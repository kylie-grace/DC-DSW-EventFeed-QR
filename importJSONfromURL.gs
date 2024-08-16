function importJSONfromURL() {
  var url1 = 'https://events.umich.edu/list/json?filter=locations:181&range=2024-07-02&v=2'; // First JSON URL
  var url2 = 'https://events.umich.edu/list/json?filter=tags:North%20Campus&range=2024-08-03&v=2'; // Second JSON URL
  
  var response1 = UrlFetchApp.fetch(url1);
  var response2 = UrlFetchApp.fetch(url2);
  
  var jsonData1 = JSON.parse(response1.getContentText());
  var jsonData2 = JSON.parse(response2.getContentText());
  
  // Combine data while avoiding duplicates using the id column
  var combinedData = [...jsonData1];
  var ids = new Set(jsonData1.map(obj => obj.id));
  
  jsonData2.forEach(obj => {
      if (!ids.has(obj.id)) {
          combinedData.push(obj);
          ids.add(obj.id);
      }
  });
  
  // Filter out events with date_start more than 60 days in the future
  var currentDate = new Date();
  var futureDate = new Date();
  futureDate.setDate(currentDate.getDate() + 60);
  
  combinedData = combinedData.filter(obj => {
      var eventDate = new Date(obj.date_start);
      return eventDate <= futureDate;
  });
  
  // Filter out events where combined_title equals "Poster Sale"
  combinedData = combinedData.filter(obj => obj.combined_title !== "Poster Sale");
  
  // Filter out events where event_type is "Performance" and room is either "McIntosh Theatre" or "Britton Recital Hall"
  combinedData = combinedData.filter(obj => {
      return !(obj.event_type === "Performance" && (obj.room === "McIntosh Theatre" || obj.room === "Britton Recital Hall"));
  });
  
  // Sort the combined data by date_start
  combinedData.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
  
  // Limit the sheet to 12 total data rows plus the header
  combinedData = combinedData.slice(0, 12);
  
  var sheetName = 'Sheet1'; // Replace with your sheet name
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  } else {
    sheet.clearContents(); // Optional: clear existing data
  }
  
  var ignoredColumns = [
    'occurrence_title', 'event_subtitle', 'has_livestream', 
    'datetime_modified', 'datetime_start', 'datetime_end', 
    'has_end_time', 'event_type_id', 'occurrence_notes', 
    'guid', 'building_official_id', 'links', 'sponsors', 
    'occurrence_count', 'first_occurrence', 'time_zone', 
    'event_title', 'building_id', 'campus_maps_id', 
    'campus_maps_link_path', 'cost', 'styled_images', 'image_description'
  ];
  
  var headers = Object.keys(combinedData[0]).filter(function(header) {
    return !ignoredColumns.includes(header);
  });
  headers.push('QR Code'); // Add a new header for QR Code
  headers.push('Event Date and Time'); // Add a new header for combined date and time
  headers.push('Time Range'); // Add a new header for time range
  headers.push('Truncated Description'); // Add a new header for truncated description
  
  // Determine the maximum number of valid images
  var maxImages = Math.max(...combinedData.map(obj => {
    if (obj.styled_images) {
      return Object.values(obj.styled_images).filter(url => !url.includes('thumb')).length;
    }
    return 0;
  }));
  
  for (var i = 1; i <= maxImages; i++) {
    headers.push('image_' + i);
  }
  
  var data = combinedData.map(function(obj) {
    var row = headers.map(function(header) {
      if (header === 'QR Code') {
        return 'https://quickchart.io/qr?text=' + encodeURIComponent(obj['permalink']) + '&margin=2&size=400.png';
      } else if (header === 'Event Date and Time') {
        var dateStart = obj['date_start'];
        
        var dateOptions = { weekday: 'long', month: 'long', day: 'numeric' }; // Exclude year
        var formattedDate = new Date(dateStart).toLocaleDateString('en-US', dateOptions);
        
        return formattedDate;
      } else if (header === 'Time Range') {
        var timeStart = obj['time_start'];
        var timeEnd = obj['time_end'];
        
        var timeOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
        
        var formattedTimeStart = new Date('1970-01-01T' + timeStart + 'Z').toLocaleTimeString('en-US', timeOptions);
        var formattedTimeEnd = new Date('1970-01-01T' + timeEnd + 'Z').toLocaleTimeString('en-US', timeOptions);
        
        return `${formattedTimeStart} - ${formattedTimeEnd}`;
      } else if (header === 'Truncated Description') {
        var description = obj['description'] || '';
        return description.split('\n')[0]; // Truncate after the first row
      } else if (header.startsWith('image_') && !header.includes('image_url')) {
        var imageIndex = parseInt(header.split('_')[1]) - 1;
        var imageUrls = obj.styled_images ? Object.values(obj.styled_images).filter(url => !url.includes('thumb')) : [];
        return imageUrls[imageIndex] ? imageUrls[imageIndex] : '';
      } else {
        return obj[header] || ''; // Handle missing headers
      }
    });
    return row;
  });
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]); // Set headers
  sheet.getRange(2, 1, data.length, headers.length).setValues(data); // Set data
  
  // Hide the image_description column
  var imageDescriptionIndex = headers.indexOf('image_description') + 1;
  if (imageDescriptionIndex > 0) {
    sheet.hideColumns(imageDescriptionIndex);
  }
}

function createTrigger() {
  ScriptApp.newTrigger('importJSONfromURL')
    .timeBased()
    .everyMinutes(5) // Adjust the interval as needed
    .create();
}
