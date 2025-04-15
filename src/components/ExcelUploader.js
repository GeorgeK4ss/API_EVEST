import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { processLead } from '../services/leadService';

const ExcelUploader = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);
  
  // API Configuration state with pre-filled static values
  const [apiConfig] = useState({
    partnerId: '81001',
    secretKey: '70bcb52124f1a3348fa488fa140f00b472aab43e179018bd7013f1f44110099f',
    authUrl: 'https://mena-evest.pandats-api.io/api/authorization',
    customerUrl: 'https://mena-evest.pandats-api.io/api/customers',
    country: 'sa',
    referral: 'affiliate_id=40175|campaign_id=136068|partner_id=c1a486dd6c8f128d0be36f669aa221fe|utm_source=Affiliate|utm_campaign=SnapAITrading'
  });

  // Function to generate and download sample Excel template
  const downloadSampleTemplate = () => {
    try {
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      
      // Sample data with headers and example rows that demonstrate the name handling feature
      const sampleData = [
        ['First Name', 'Last Name', 'Phone', 'Email'],
        ['John', 'Doe', '1234567890', '1234567890@gmail.com'],
        ['Jane Smith', '', '9876543210', '9876543210@gmail.com'],
        ['Robert James Miller', '', '5554443333', '5554443333@gmail.com'],
        ['Maria', '', '7778889999', '7778889999@gmail.com']
      ];
      
      // Create worksheet from sample data
      const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
      
      // Add column width for better readability
      const wscols = [
        {wch: 20}, // First Name
        {wch: 15}, // Last Name
        {wch: 15}, // Phone
        {wch: 25}  // Email
      ];
      worksheet['!cols'] = wscols;
      
      // Add explanatory notes
      XLSX.utils.sheet_add_aoa(worksheet, [
        [''],
        ['Notes:'],
        ['1. Row 2: Standard format with First and Last Name in separate columns'],
        ['2. Row 3: First and Last Name in "First Name" column - last word becomes Last Name'],
        ['3. Row 4: Full name in "First Name" column - last word becomes Last Name'],
        ['4. Row 5: Single word in "First Name" column - copied to Last Name']
      ], {origin: 'A6'});
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads Template');
      
      // Generate Excel file and trigger download
      XLSX.writeFile(workbook, 'leads_template.xlsx');
      
      toast.success('Sample template downloaded successfully');
    } catch (error) {
      console.error('Error generating sample template:', error);
      toast.error('Failed to download sample template');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      parseExcel(selectedFile);
    }
  };

  const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        // Find column indices
        const headers = jsonData[0].map(header => header.toLowerCase());
        const firstNameIndex = headers.indexOf('first name');
        const lastNameIndex = headers.indexOf('last name');
        const phoneIndex = headers.indexOf('phone');
        const emailIndex = headers.indexOf('email');
        
        if (firstNameIndex === -1 || phoneIndex === -1) {
          toast.error('Excel file must contain at least "First Name" and "Phone" columns');
          return;
        }
        
        // Parse data rows
        const parsedLeads = jsonData.slice(1).map(row => {
          let firstName = row[firstNameIndex] || '';
          let lastName = '';
          
          // Check if last name column exists
          if (lastNameIndex !== -1) {
            lastName = row[lastNameIndex] || '';
          }
          
          // If last name is empty, handle automation logic
          if (!lastName && firstName) {
            const nameParts = firstName.trim().split(' ');
            
            if (nameParts.length > 1) {
              // If more than one word, move last word to last name
              lastName = nameParts.pop();
              firstName = nameParts.join(' ');
            } else {
              // If only one word, copy it to last name
              lastName = firstName;
            }
          }
          
          return {
            firstName: firstName,
            lastName: lastName,
            phone: row[phoneIndex] ? row[phoneIndex].toString() : '',
            email: emailIndex !== -1 ? row[emailIndex] : undefined
          };
        }).filter(lead => lead.firstName && lead.lastName && lead.phone);
        
        setLeads(parsedLeads);
        toast.success(`Successfully parsed ${parsedLeads.length} leads from Excel`);
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        toast.error('Failed to parse Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateConfig = () => {
    const required = ['partnerId', 'secretKey', 'authUrl', 'customerUrl', 'country'];
    for (const field of required) {
      if (!apiConfig[field]) {
        toast.error(`${field} is required`);
        return false;
      }
    }
    return true;
  };

  const processLeads = async () => {
    if (!leads.length) {
      toast.error('No leads to process');
      return;
    }
    
    if (!validateConfig()) {
      return;
    }
    
    setIsUploading(true);
    setResults([]);
    setProgress(0);
    
    const processedResults = [];
    
    for (let i = 0; i < leads.length; i++) {
      try {
        const lead = leads[i];
        const result = await processLead(lead, apiConfig);
        
        processedResults.push({
          lead,
          success: result.success,
          message: result.message,
          data: result.data
        });
        
        if (result.success) {
          toast.success(`Processed lead: ${lead.firstName} ${lead.lastName}`);
        } else {
          toast.error(`Failed to process lead: ${lead.firstName} ${lead.lastName}`);
        }
      } catch (error) {
        processedResults.push({
          lead: leads[i],
          success: false,
          message: error.message || 'Unknown error'
        });
        toast.error(`Error processing lead: ${error.message}`);
      }
      
      // Update progress
      setProgress(Math.round(((i + 1) / leads.length) * 100));
      setResults([...processedResults]);
    }
    
    setIsUploading(false);
    toast.info(`Completed processing ${leads.length} leads`);
  };

  const resetForm = () => {
    setLeads([]);
    setResults([]);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title mb-4">Upload Excel File with Leads</h5>
        
        <div className="mb-4">
          <h6>API Configuration (Pre-configured)</h6>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Partner ID</label>
              <input
                type="text"
                className="form-control"
                name="partnerId"
                value={apiConfig.partnerId}
                readOnly
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Secret Key</label>
              <input
                type="password"
                className="form-control"
                name="secretKey"
                value={apiConfig.secretKey}
                readOnly
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Auth URL</label>
              <input
                type="text"
                className="form-control"
                name="authUrl"
                value={apiConfig.authUrl}
                readOnly
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Customer URL</label>
              <input
                type="text"
                className="form-control"
                name="customerUrl"
                value={apiConfig.customerUrl}
                readOnly
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Country</label>
              <input
                type="text"
                className="form-control"
                name="country"
                value={apiConfig.country}
                readOnly
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Referral</label>
              <input
                type="text"
                className="form-control"
                name="referral"
                value={apiConfig.referral}
                readOnly
              />
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="form-label">Choose Excel File</label>
          <div className="d-flex gap-2 mb-2">
            <input 
              type="file"
              className="form-control"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              ref={fileInputRef}
            />
            <button 
              className="btn btn-outline-secondary" 
              onClick={downloadSampleTemplate}
              title="Download a sample Excel template"
            >
              <i className="bi bi-download"></i> Template
            </button>
          </div>
          <div className="form-text">
            File must contain at least "First Name" and "Phone" columns. If only First Name is provided with multiple words, 
            the last word will be used as Last Name.
          </div>
        </div>
        
        {leads.length > 0 && (
          <div className="mb-4">
            <h6>Parsed Leads: {leads.length}</h6>
            <div className="table-responsive">
              <table className="table table-sm table-striped">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 5).map((lead, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{lead.firstName}</td>
                      <td>{lead.lastName}</td>
                      <td>{lead.phone}</td>
                      <td>{lead.email || '-'}</td>
                    </tr>
                  ))}
                  {leads.length > 5 && (
                    <tr>
                      <td colSpan="5" className="text-center">
                        ...and {leads.length - 5} more leads
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {isUploading && (
          <div className="mb-4">
            <h6>Uploading Progress: {progress}%</h6>
            <div className="progress">
              <div 
                className="progress-bar" 
                role="progressbar" 
                style={{ width: `${progress}%` }}
                aria-valuenow={progress} 
                aria-valuemin="0" 
                aria-valuemax="100"
              ></div>
            </div>
          </div>
        )}
        
        {results.length > 0 && (
          <div className="mb-4">
            <h6>Results:</h6>
            <div className="table-responsive">
              <table className="table table-sm table-striped">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index} className={result.success ? 'table-success' : 'table-danger'}>
                      <td>{index + 1}</td>
                      <td>{result.lead.firstName} {result.lead.lastName}</td>
                      <td>{result.success ? 'Success' : 'Failed'}</td>
                      <td>
                        {typeof result.message === 'string' 
                          ? result.message 
                          : Array.isArray(result.message)
                            ? result.message.map(err => 
                                typeof err === 'object' 
                                  ? `${err.field || ''}: ${err.description || JSON.stringify(err)}`
                                  : String(err)
                              ).join('; ')
                            : result.message && typeof result.message === 'object' && result.message.error && Array.isArray(result.message.error)
                              ? result.message.error.map(err => 
                                  typeof err === 'object' 
                                    ? `${err.field || ''}: ${err.description || JSON.stringify(err)}`
                                    : String(err)
                                ).join('; ')
                              : typeof result.message === 'object'
                                ? JSON.stringify(result.message)
                                : 'Unknown error'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        <div className="d-flex gap-2">
          <button 
            className="btn btn-primary" 
            onClick={processLeads} 
            disabled={isUploading || leads.length === 0}
          >
            {isUploading ? 'Processing...' : 'Process Leads'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={resetForm} 
            disabled={isUploading}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExcelUploader; 