# Excel Leads Uploader

A React application to upload Excel files containing leads (First Name, Last Name, Phone) and send them to an API one by one.

## Features

- Upload Excel files (.xlsx, .xls)
- Parse leads from Excel file
- API configuration form
- Process leads one by one
- Track progress with a progress bar
- View results in a table
- Success/Error notifications

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```
git clone <repository-url>
```

2. Navigate to the project directory:
```
cd excel-leads-uploader
```

3. Install dependencies:
```
npm install
```

4. Start the development server:
```
npm start
```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Fill in the API configuration fields:
   - Partner ID
   - Secret Key
   - Auth URL
   - Customer URL
   - Country
   - Referral (optional)

2. Upload an Excel file with the following columns:
   - First Name
   - Last Name
   - Phone
   - Email (optional)

3. Review the parsed leads

4. Click "Process Leads" to start uploading each lead to the API

5. Monitor progress and view results

## Excel File Format

The Excel file should have a header row with the following columns:
- "First Name"
- "Last Name" 
- "Phone"
- "Email" (optional)

Example:

| First Name | Last Name | Phone       | Email                  |
|------------|-----------|-------------|-----------------------|
| John       | Doe       | 1234567890  | john.doe@example.com  |
| Jane       | Smith     | 0987654321  | jane.smith@example.com|

## API Integration

The application uses a two-step API process:
1. Authentication to obtain a token
2. Creating a customer using the token

Each lead is processed sequentially to ensure proper handling and to prevent overloading the API. 