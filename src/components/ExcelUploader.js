import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { processLead } from '../services/leadService';
import referralData from '../data/referralData.json';

// Parameters whose options/labels the user can edit and we persist.
// campaign_id is NOT here: it is derived from affiliate_id via campaignByAffiliate.
const EDITABLE_REFERRAL_KEYS = ['affiliate_id', 'utm_campaign'];
const STORAGE_KEY = 'referralData';

// Defaults for the locked parameters (not user-editable, not persisted).
const LOCKED_DEFAULTS = {
  options: {
    partner_id: ['c1a486dd6c8f128d0be36f669aa221fe'],
    utm_source: ['Affiliate']
  }
};

// Load persisted referral data: localStorage (runtime edits) merged over the JSON seed.
const loadReferralData = () => {
  const seed = {
    options: { ...referralData.options },
    labels: { ...referralData.labels },
    campaignByAffiliate: { ...(referralData.campaignByAffiliate || {}) }
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.options) {
      EDITABLE_REFERRAL_KEYS.forEach((key) => {
        // Union: keep shared (file) entries AND any locally-added ones.
        const base = seed.options[key] || [];
        const extra = (saved.options[key] || []).filter((v) => !base.includes(v));
        seed.options[key] = [...base, ...extra];
        // Labels: file seed wins, local fills any gaps.
        seed.labels[key] = { ...(saved.labels && saved.labels[key]), ...seed.labels[key] };
      });
      // Affiliate -> campaign map: file seed wins, local fills any gaps.
      seed.campaignByAffiliate = { ...saved.campaignByAffiliate, ...seed.campaignByAffiliate };
    }
  } catch (e) {
    console.warn('Could not read saved referral data', e);
  }
  return seed;
};

const ExcelUploader = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  // In-page paste editor (rows copied from Excel/Sheets), pre-seeded with headers.
  const PASTE_HEADER = 'First Name\tLast Name\tPhone\tEmail\tutm_campaign';
  const [pasteText, setPasteText] = useState(PASTE_HEADER + '\n');
  
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

  // Load persisted (JSON seed + localStorage) data once on mount.
  const initialData = loadReferralData();

  // Available options for each referral parameter (you can add more at runtime)
  const [referralOptions, setReferralOptions] = useState({
    ...initialData.options,
    ...LOCKED_DEFAULTS.options
  });

  // Friendly internal-only labels for option values (display only, never sent).
  // e.g. affiliate_id "40175" is shown as "BrokerBase".
  const [referralLabels, setReferralLabels] = useState(initialData.labels);

  // Map of affiliate_id -> campaign_id. Picking an affiliate auto-sets the campaign.
  const [campaignMap, setCampaignMap] = useState(initialData.campaignByAffiliate);

  // Persist editable options/labels + campaign map to localStorage (fallback / offline cache).
  useEffect(() => {
    const toSave = { options: {}, labels: {}, campaignByAffiliate: campaignMap };
    EDITABLE_REFERRAL_KEYS.forEach((key) => {
      toSave.options[key] = referralOptions[key] || [];
      toSave.labels[key] = referralLabels[key] || {};
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Could not save referral data', e);
    }
  }, [referralOptions, referralLabels, campaignMap]);

  // Apply a dataset ({ options, labels, campaignByAffiliate }) from the API into state.
  const applyReferralData = (data) => {
    if (!data || !data.options) return;
    setReferralOptions((prev) => {
      const next = { ...prev };
      EDITABLE_REFERRAL_KEYS.forEach((key) => {
        if (data.options[key]) next[key] = data.options[key];
      });
      return next;
    });
    setReferralLabels((prev) => {
      const next = { ...prev };
      EDITABLE_REFERRAL_KEYS.forEach((key) => {
        if (data.labels && data.labels[key]) next[key] = data.labels[key];
      });
      return next;
    });
    if (data.campaignByAffiliate) {
      setCampaignMap(data.campaignByAffiliate);
      // Re-sync the derived campaign_id for the currently selected affiliate.
      setReferralValues((prev) => ({
        ...prev,
        campaign_id: data.campaignByAffiliate[prev.affiliate_id] || prev.campaign_id
      }));
    }
  };

  // On mount, try to load the latest list from the backend (file-backed).
  useEffect(() => {
    fetch('/api/referral')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => applyReferralData(data))
      .catch(() => {
        /* No backend (e.g. GitHub Pages): keep JSON seed + localStorage. */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build the text shown in a dropdown: "BrokerBase (40175)" or just the value.
  const optionLabel = (key, value) => {
    const label = referralLabels[key] && referralLabels[key][value];
    return label ? `${label} (${value})` : value;
  };

  // Currently selected value for each referral parameter
  const [referralValues, setReferralValues] = useState(() => {
    const affiliate = (initialData.options.affiliate_id || ['40175'])[0];
    return {
      affiliate_id: affiliate,
      campaign_id: initialData.campaignByAffiliate[affiliate] || '136068',
      partner_id: 'c1a486dd6c8f128d0be36f669aa221fe',
      utm_source: 'Affiliate',
      utm_campaign: (initialData.options.utm_campaign || ['SnapAITrading'])[0]
    };
  });

  // Text typed into the "add new option" input for each referral parameter
  const [newOption, setNewOption] = useState({});

  // Optional friendly name typed alongside a new option value
  const [newOptionLabel, setNewOptionLabel] = useState({});

  // Campaign ID typed alongside a new affiliate_id (its linked campaign)
  const [newOptionCampaign, setNewOptionCampaign] = useState({});

  // Build the referral string. Optionally override utm_campaign per lead (from Excel).
  const buildReferral = (utmOverride) =>
    REFERRAL_KEYS
      .map((key) => {
        if (key === 'utm_campaign') {
          return { key, value: (utmOverride || referralValues.utm_campaign || '').toString().trim() };
        }
        return { key, value: referralValues[key] };
      })
      .filter(({ value }) => value)
      .map(({ key, value }) => `${key}=${value}`)
      .join('|');

  const handleReferralChange = (key, value) => {
    setReferralValues((prev) => {
      const next = { ...prev, [key]: value };
      // Picking an affiliate auto-sets its linked campaign_id.
      if (key === 'affiliate_id') {
        next.campaign_id = campaignMap[value] || '';
      }
      return next;
    });
  };

  const addReferralOption = (key) => {
    const value = (newOption[key] || '').trim();
    if (!value) return;
    const label = (newOptionLabel[key] || '').trim();
    const campaign = key === 'affiliate_id' ? (newOptionCampaign[key] || '').trim() : '';

    if (key === 'affiliate_id' && !campaign) {
      toast.error('Please enter the Campaign ID for this affiliate');
      return;
    }

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
    if (key === 'affiliate_id' && campaign) {
      setCampaignMap((prev) => ({ ...prev, [value]: campaign }));
    }
    setReferralValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'affiliate_id') next.campaign_id = campaign;
      return next;
    });
    setNewOption((prev) => ({ ...prev, [key]: '' }));
    setNewOptionLabel((prev) => ({ ...prev, [key]: '' }));
    setNewOptionCampaign((prev) => ({ ...prev, [key]: '' }));

    // Try to persist to the file via the backend; ignore if it's not running.
    if (EDITABLE_REFERRAL_KEYS.includes(key)) {
      fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, label, campaign })
      })
        .then((res) => {
          if (res.ok) {
            toast.success(`Saved ${key}: ${label ? `${label} (${value})` : value}`);
          }
        })
        .catch(() => {
          /* Backend offline: value is still kept in localStorage. */
        });
    }
  };

  // Function to generate and download sample Excel template
  const downloadSampleTemplate = () => {
    try {
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      
      // Sample data with headers and example rows that demonstrate the name handling feature
      const sampleData = [
        ['First Name', 'Last Name', 'Phone', 'Email', 'utm_campaign'],
        ['John', 'Doe', '1234567890', '1234567890@gmail.com', 'SnapAITrading'],
        ['Jane Smith', '', '9876543210', '9876543210@gmail.com', 'SummerPromo'],
        ['Robert James Miller', '', '5554443333', '5554443333@gmail.com', ''],
        ['Maria', '', '7778889999', '7778889999@gmail.com', '']
      ];
      
      // Create worksheet from sample data
      const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
      
      // Add column width for better readability
      const wscols = [
        {wch: 20}, // First Name
        {wch: 15}, // Last Name
        {wch: 15}, // Phone
        {wch: 25}, // Email
        {wch: 18}  // utm_campaign
      ];
      worksheet['!cols'] = wscols;
      
      // Add explanatory notes
      XLSX.utils.sheet_add_aoa(worksheet, [
        [''],
        ['Notes:'],
        ['1. Row 2: Standard format with First and Last Name in separate columns'],
        ['2. Row 3: First and Last Name in "First Name" column - last word becomes Last Name'],
        ['3. Row 4: Full name in "First Name" column - last word becomes Last Name'],
        ['4. Row 5: Single word in "First Name" column - copied to Last Name'],
        ['5. utm_campaign is optional per lead; if blank, the panel default is used']
      ], {origin: 'A8'});
      
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

  // Coerce any cell to a trimmed string (handles numbers, dates, blanks)
  const cell = (value) => (value === null || value === undefined ? '' : String(value).trim());

  // Turn a 2D array (first row = headers) into leads. Shared by file upload + paste.
  const rowsToLeads = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(rows[0])) {
      toast.error('No data found');
      return;
    }

    const headers = rows[0].map((h) => cell(h).toLowerCase());
    const firstNameIndex = headers.indexOf('first name');
    const lastNameIndex = headers.indexOf('last name');
    const phoneIndex = headers.indexOf('phone');
    const emailIndex = headers.indexOf('email');
    const utmCampaignIndex = ['utm_campaign', 'utm campaign', 'campaign'].reduce(
      (found, name) => (found !== -1 ? found : headers.indexOf(name)),
      -1
    );

    if (firstNameIndex === -1 || phoneIndex === -1) {
      toast.error('Data must contain at least "First Name" and "Phone" columns');
      return;
    }

    const parsedLeads = rows.slice(1)
      .map((row) => {
        if (!Array.isArray(row)) return null;
        let firstName = cell(row[firstNameIndex]);
        let lastName = lastNameIndex !== -1 ? cell(row[lastNameIndex]) : '';

        if (!lastName && firstName) {
          const nameParts = firstName.split(' ').filter(Boolean);
          if (nameParts.length > 1) {
            lastName = nameParts.pop();
            firstName = nameParts.join(' ');
          } else {
            lastName = firstName;
          }
        }

        const email = emailIndex !== -1 ? cell(row[emailIndex]) : '';
        const utmCampaign = utmCampaignIndex !== -1 ? cell(row[utmCampaignIndex]) : '';
        return {
          firstName,
          lastName,
          phone: cell(row[phoneIndex]),
          email: email || undefined,
          utmCampaign: utmCampaign || undefined
        };
      })
      .filter((lead) => lead && lead.firstName && lead.lastName && lead.phone);

    setLeads(parsedLeads);
    const withUtm = parsedLeads.filter((l) => l.utmCampaign).length;
    toast.success(
      `Parsed ${parsedLeads.length} leads` +
        (utmCampaignIndex !== -1 ? ` · ${withUtm} with utm_campaign` : '')
    );
  };

  // Parse text copied from Excel/Sheets (tab- or comma-separated rows).
  const parsePastedData = () => {
    const text = (pasteText || '').replace(/\r/g, '').trim();
    if (!text) {
      toast.error('Paste some rows first');
      return;
    }
    const rows = text.split('\n').map((line) => {
      const delimiter = line.includes('\t') ? '\t' : ',';
      return line.split(delimiter);
    });
    rowsToLeads(rows);
  };

  const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        rowsToLeads(jsonData);
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
        const result = await processLead(lead, {
          ...apiConfig,
          referral: buildReferral(lead.utmCampaign)
        });
        
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
          {/* affiliate_id: editable, drives campaign_id */}
          <div className="ap-rel">
            <label className="ap-label">affiliate_id</label>
            <select
              className="ap-select"
              value={referralValues.affiliate_id}
              onChange={(e) => handleReferralChange('affiliate_id', e.target.value)}
            >
              {referralOptions.affiliate_id.map((option) => (
                <option key={option} value={option}>
                  {optionLabel('affiliate_id', option)}
                </option>
              ))}
            </select>
            <div className="ap-add-group">
              <input
                className="ap-input"
                placeholder="Affiliate ID"
                value={newOption.affiliate_id || ''}
                onChange={(e) =>
                  setNewOption((prev) => ({ ...prev, affiliate_id: e.target.value }))
                }
              />
              <input
                className="ap-input"
                placeholder="Name"
                value={newOptionLabel.affiliate_id || ''}
                onChange={(e) =>
                  setNewOptionLabel((prev) => ({ ...prev, affiliate_id: e.target.value }))
                }
              />
              <input
                className="ap-input"
                placeholder="Campaign ID"
                value={newOptionCampaign.affiliate_id || ''}
                onChange={(e) =>
                  setNewOptionCampaign((prev) => ({ ...prev, affiliate_id: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addReferralOption('affiliate_id');
                  }
                }}
              />
              <button
                type="button"
                className="ap-btn ap-btn-ghost ap-btn-sm"
                onClick={() => addReferralOption('affiliate_id')}
              >
                <i className="bi bi-plus-lg"></i>
              </button>
            </div>
          </div>

          {/* campaign_id: derived from the selected affiliate (read-only) */}
          <div className="ap-rel">
            <label className="ap-label">campaign_id</label>
            <input className="ap-input" value={referralValues.campaign_id || '—'} readOnly />
            <i className="bi bi-link-45deg ap-field-lock"></i>
            <p className="ap-hint" style={{ marginTop: 6 }}>
              Auto-linked to affiliate
            </p>
          </div>

          {/* utm_campaign: editable default; overridden per-lead by the Excel column */}
          <div className="ap-rel">
            <label className="ap-label">utm_campaign</label>
            <select
              className="ap-select"
              value={referralValues.utm_campaign}
              onChange={(e) => handleReferralChange('utm_campaign', e.target.value)}
            >
              {referralOptions.utm_campaign.map((option) => (
                <option key={option} value={option}>
                  {optionLabel('utm_campaign', option)}
                </option>
              ))}
            </select>
            <div className="ap-add-group">
              <input
                className="ap-input"
                placeholder="Add utm_campaign"
                value={newOption.utm_campaign || ''}
                onChange={(e) =>
                  setNewOption((prev) => ({ ...prev, utm_campaign: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addReferralOption('utm_campaign');
                  }
                }}
              />
              <button
                type="button"
                className="ap-btn ap-btn-ghost ap-btn-sm"
                onClick={() => addReferralOption('utm_campaign')}
              >
                <i className="bi bi-plus-lg"></i>
              </button>
            </div>
            <p className="ap-hint" style={{ marginTop: 6 }}>
              Default if the Excel has no utm_campaign column
            </p>
          </div>
        </div>

        <p className="ap-hint">
          {referralLabels.affiliate_id && referralLabels.affiliate_id[referralValues.affiliate_id] && (
            <>
              Affiliate:{' '}
              <span className="ap-code">
                {referralLabels.affiliate_id[referralValues.affiliate_id]}
              </span>
              {' → campaign '}
              <span className="ap-code">{referralValues.campaign_id || '—'}</span>
              <br />
            </>
          )}
          {referralValues.utm_campaign && (
            <>
              utm_campaign (default):{' '}
              <span className="ap-code">{referralValues.utm_campaign}</span>
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
          multiple words, the last word becomes the Last Name. Add an optional{' '}
          <span className="ap-code">utm_campaign</span> column to set it per lead; blank rows fall
          back to the default above.
        </p>
      </div>

      {/* Paste from Excel */}
      <div className="ap-card">
        <div className="ap-card-head">
          <i className="bi bi-clipboard-data-fill"></i>
          <div>
            <h2 className="ap-card-title">Paste from Excel</h2>
            <p className="ap-card-sub">
              Copy cells from Excel/Sheets and paste below (keep the header row)
            </p>
          </div>
        </div>

        <textarea
          className="ap-input ap-paste"
          spellCheck={false}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={PASTE_HEADER + '\nJohn\tDoe\t0501234567\t\tSnapAITrading'}
          rows={8}
        />

        <div className="ap-actions" style={{ marginTop: 14, position: 'static' }}>
          <button className="ap-btn ap-btn-ghost ap-btn-sm" onClick={parsePastedData}>
            <i className="bi bi-table"></i> Parse pasted rows
          </button>
          <button
            className="ap-btn ap-btn-ghost ap-btn-sm"
            onClick={() => setPasteText(PASTE_HEADER + '\n')}
          >
            <i className="bi bi-eraser"></i> Clear
          </button>
        </div>

        <p className="ap-hint">
          First row must be the header. Columns are tab-separated (pasting from Excel does this
          automatically) or comma-separated.
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
                  <th>utm_campaign</th>
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
                    <td className="ap-mono">{lead.utmCampaign || referralValues.utm_campaign}</td>
                  </tr>
                ))}
                {leads.length > 5 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--ap-muted)' }}>
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