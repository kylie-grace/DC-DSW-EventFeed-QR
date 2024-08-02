function importJSONfromURL() {
    var url = 'https://events.umich.edu/list/json?filter=locations:181&range=2024-07-02&v=2'; // Replace with your live JSON URL
    var response = UrlFetchApp.fetch(url);
    var jsonData = JSON.parse(response.getContentText());
    
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
      'occurrence_count', 'first_occurrence', 'id', 'time_zone', 
      'event_title', 'building_id', 'campus_maps_id', 
      'campus_maps_link_path', 'cost', 'styled_images', 'image_description'
    ];
    
    var headers = Object.keys(jsonData[0]).filter(function(header) {
      return !ignoredColumns.includes(header);
    });
    headers.push('QR Code'); // Add a new header for QR Code
    
    // Determine the maximum number of valid images
    var maxImages = Math.max(...jsonData.map(obj => {
      if (obj.styled_images) {
        return Object.values(obj.styled_images).filter(url => !url.includes('thumb')).length;
      }
      return 0;
    }));
    
    for (var i = 1; i <= maxImages; i++) {
      headers.push('image_' + i);
    }
    
    var data = jsonData.map(function(obj) {
      var row = headers.map(function(header) {
        if (header === 'QR Code') {
          return 'https://quickchart.io/qr?text=' + encodeURIComponent(obj['permalink']) + '.png';
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