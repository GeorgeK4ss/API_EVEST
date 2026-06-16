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
    country: 'sa'
  });

  // Referral parameters, each rendered as its own dropdown
  const REFERRAL_KEYS = ['affiliate_id', 'campaign_id', 'partner_id', 'utm_source', 'utm_campaign'];

  // These parameters are fixed: read-only, no dropdown and no "add option"
  const LOCKED_REFERRAL_KEYS = ['partner_id', 'utm_source'];

  // Available options for each referral parameter (you can add more at runtime)
  const [referralOptions, setReferralOptions] = useState({
    affiliate_id: ['40175'],
    campaign_id: ['136068'],
    partner_id: ['c1a486dd6c8f128d0be36f669aa221fe'],
    utm_source: ['Affiliate'],
    utm_campaign: ['SnapAITrading']
  });

  // Friendly internal-only labels for option values (display only, never sent).
  // e.g. affiliate_id "40175" is shown as "BrokerBase".
  const [referralLabels, setReferralLabels] = useState({
    affiliate_id: { '40175': 'BrokerBase' }
  });

  // Build the text shown in a dropdown: "BrokerBase (40175)" or just the value.
  const optionLabel = (key, value) => {
    const label = referralLabels[key] && referralLabels[key][value];
    return label ? `${label} (${value})` : value;
  };

  // Currently selected value for each referral parameter
  const [referralValues, setReferralValues] = useState({
    affiliate_id: '40175',
    campaign_id: '136068',
    partner_id: 'c1a486dd6c8f128d0be36f669aa221fe',
    utm_source: 'Affiliate',
    utm_campaign: 'SnapAITrading'
  });

  // Text typed into the "add new option" input for each referral parameter
  const [newOption, setNewOption] = useState({});

  // Optional friendly name typed alongside a new option value
  const [newOptionLabel, setNewOptionLabel] = useState({});

  // Build the referral string from the selected values, e.g. "affiliate_id=40175|campaign_id=..."
  const buildReferral = () =>
    REFERRAL_KEYS
      .filter((key) => referralValues[key])
      .map((key) => `${key}=${referralValues[key]}`)
      .join('|');

  const handleReferralChange = (key, value) => {
    setReferralValues((prev) => ({ ...prev, [key]: value }));
  };

  const addReferralOption = (key) => {
    const value = (newOption[key] || '').trim();
    if (!value) return;
    const label = (newOptionLabel[key] || '').trim();
    setReferralOptions((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key] : [...prev[key], value]
    }));
    if (label) {
      setReferralLabels((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), [value]: label }
      }));
    }
    setReferralValues((prev) => ({ ...prev, [key]: value }));
    setNewOption((prev) => ({ ...prev, [key]: '' }));
    setNewOptionLabel((prev) => ({ ...prev, [key]: '' }));
  };

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
        const result = await processLead(lead, { ...apiConfig, referral: buildReferral() });
        
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

  const formatMessage = (message) => {
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) {
      return message
        .map((err) =>
          typeof err === 'object'
            ? `${err.field || ''}: ${err.description || JSON.stringify(err)}`
            : String(err)
        )
        .join('; ');
    }
    if (message && typeof message === 'object' && Array.isArray(message.error)) {
      return message.error
        .map((err) =>
          typeof err === 'object'
            ? `${err.field || ''}: ${err.description || JSON.stringify(err)}`
            : String(err)
        )
        .join('; ');
    }
    if (typeof message === 'object') return JSON.stringify(message);
    return 'Unknown error';
  };

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.length - successCount;

  return (
    <>
      {/* API Configuration */}
      <div className="ap-card">
        <div className="ap-card-head">
          <i className="bi bi-shield-lock-fill"></i>
          <div>
            <h2 className="ap-card-title">API Configuration</h2>
            <p className="ap-card-sub">Pre-configured broker credentials &middot; read-only</p>
          </div>
        </div>

        <div className="ap-grid ap-grid-2">
          <div>
            <label className="ap-label">Partner ID</label>
            <input className="ap-input" value={apiConfig.partnerId} readOnly />
          </div>
          <div>
            <label className="ap-label">Secret Key</label>
            <input className="ap-input" type="password" value={apiConfig.secretKey} readOnly />
          </div>
          <div>
            <label className="ap-label">Auth URL</label>
            <input className="ap-input" value={apiConfig.authUrl} readOnly />
          </div>
          <div>
            <label className="ap-label">Customer URL</label>
            <input className="ap-input" value={apiConfig.customerUrl} readOnly />
          </div>
          <div>
            <label className="ap-label">Country</label>
            <input className="ap-input" value={apiConfig.country} readOnly />
          </div>
          {LOCKED_REFERRAL_KEYS.map((key) => (
            <div className="ap-rel" key={key}>
              <label className="ap-label">{key}</label>
              <input className="ap-input" value={referralValues[key]} readOnly />
              <i className="bi bi-lock-fill ap-field-lock"></i>
            </div>
          ))}
        </div>
      </div>

      {/* Referral parameters */}
      <div className="ap-card">
        <div className="ap-card-head">
          <i className="bi bi-diagram-3-fill"></i>
          <div>
            <h2 className="ap-card-title">Referral Parameters</h2>
            <p className="ap-card-sub">Tag every lead with your tracking attributes</p>
          </div>
        </div>

        <div className="ap-grid ap-grid-3">
          {REFERRAL_KEYS.filter((key) => !LOCKED_REFERRAL_KEYS.includes(key)).map((key) => (
            <div className="ap-rel" key={key}>
              <label className="ap-label">{key}</label>
              <select
                className="ap-select"
                value={referralValues[key]}
                onChange={(e) => handleReferralChange(key, e.target.value)}
              >
                {referralOptions[key].map((option) => (
                  <option key={option} value={option}>
                    {optionLabel(key, option)}
                  </option>
                ))}
              </select>
              <div className="ap-add-group">
                <input
                  className="ap-input"
                  placeholder="Value"
                  value={newOption[key] || ''}
                  onChange={(e) =>
                    setNewOption((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addReferralOption(key);
                    }
                  }}
                />
                <input
                  className="ap-input"
                  placeholder="Name (optional)"
                  value={newOptionLabel[key] || ''}
                  onChange={(e) =>
                    setNewOptionLabel((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addReferralOption(key);
                    }
                  }}
                />
                <button
                  type="button"
                  className="ap-btn ap-btn-ghost ap-btn-sm"
                  onClick={() => addReferralOption(key)}
                >
                  <i className="bi bi-plus-lg"></i>
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="ap-hint">
          {referralLabels.affiliate_id && referralLabels.affiliate_id[referralValues.affiliate_id] && (
            <>
              Affiliate:{' '}
              <span className="ap-code">
                {referralLabels.affiliate_id[referralValues.affiliate_id]}
              </span>
              <br />
            </>
          )}
          {referralValues.utm_campaign && (
            <>
              Campaign:{' '}
              <span className="ap-code">{optionLabel('utm_campaign', referralValues.utm_campaign)}</span>
              <br />
            </>
          )}
          Resulting referral (sent): <span className="ap-code">{buildReferral()}</span>
        </p>
      </div>

      {/* Upload */}
      <div className="ap-card">
        <div className="ap-card-head">
          <i className="bi bi-file-earmark-spreadsheet-fill"></i>
          <div>
            <h2 className="ap-card-title">Upload Leads</h2>
            <p className="ap-card-sub">Drop an Excel file or browse from your device</p>
          </div>
        </div>

        <div className="ap-dropzone">
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            ref={fileInputRef}
          />
          <div className="ap-dropzone-icon">
            <i className="bi bi-cloud-arrow-up-fill"></i>
          </div>
          <p className="ap-dropzone-title">Click to upload or drag &amp; drop</p>
          <p className="ap-dropzone-hint">.xlsx or .xls &middot; max one sheet read</p>
        </div>

        <div className="ap-actions" style={{ marginTop: 16, position: 'static' }}>
          <button className="ap-btn ap-btn-ghost ap-btn-sm" onClick={downloadSampleTemplate}>
            <i className="bi bi-download"></i> Download template
          </button>
        </div>

        <p className="ap-hint">
          File must contain at least <span className="ap-code">First Name</span> and{' '}
          <span className="ap-code">Phone</span> columns. If only First Name is provided with
          multiple words, the last word becomes the Last Name.
        </p>
      </div>

      {/* Parsed leads */}
      {leads.length > 0 && (
        <div className="ap-card">
          <span className="ap-section-tag">Preview</span>
          <div className="ap-stats">
            <div className="ap-stat">
              <div className="ap-stat-num is-primary">{leads.length}</div>
              <div className="ap-stat-label">Leads parsed</div>
            </div>
            <div className="ap-stat">
              <div className="ap-stat-num">{leads.filter((l) => l.email).length}</div>
              <div className="ap-stat-label">With email</div>
            </div>
          </div>

          <div className="ap-table-wrap">
            <table className="ap-table">
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
                    <td className="ap-mono">{lead.phone}</td>
                    <td className="ap-mono">{lead.email || '—'}</td>
                  </tr>
                ))}
                {leads.length > 5 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--ap-muted)' }}>
                      …and {leads.length - 5} more leads
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Progress */}
      {isUploading && (
        <div className="ap-card">
          <div className="ap-progress-head">
            <span>Uploading leads to broker…</span>
            <b>{progress}%</b>
          </div>
          <div className="ap-progress">
            <div className="ap-progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="ap-card">
          <span className="ap-section-tag">Results</span>
          <div className="ap-stats">
            <div className="ap-stat">
              <div className="ap-stat-num">{results.length}</div>
              <div className="ap-stat-label">Processed</div>
            </div>
            <div className="ap-stat">
              <div className="ap-stat-num is-success">{successCount}</div>
              <div className="ap-stat-label">Succeeded</div>
            </div>
            <div className="ap-stat">
              <div className="ap-stat-num is-danger">{failedCount}</div>
              <div className="ap-stat-label">Failed</div>
            </div>
          </div>

          <div className="ap-table-wrap">
            <table className="ap-table">
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
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{result.lead.firstName} {result.lead.lastName}</td>
                    <td>
                      <span className={`ap-pill ${result.success ? 'ok' : 'fail'}`}>
                        <i className={`bi ${result.success ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                        {result.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td>{formatMessage(result.message)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="ap-actions">
        <button
          className="ap-btn ap-btn-primary"
          onClick={processLeads}
          disabled={isUploading || leads.length === 0}
        >
          {isUploading ? (
            <>
              <i className="bi bi-arrow-repeat"></i> Processing…
            </>
          ) : (
            <>
              <i className="bi bi-send-fill"></i> Process {leads.length > 0 ? `${leads.length} ` : ''}Leads
            </>
          )}
        </button>
        <button className="ap-btn ap-btn-ghost" onClick={resetForm} disabled={isUploading}>
          <i className="bi bi-arrow-counterclockwise"></i> Reset
        </button>
      </div>
    </>
  );
};

export default ExcelUploader; 