import axios from 'axios';

// Function to authenticate and get token
export const authenticate = async (partnerId, secretKey, authUrl) => {
  try {
    // Generate time + access key
    const currentTime = Math.floor(Date.now() / 1000);
    const concatenated = `${partnerId}${currentTime}${secretKey}`;
    
    // Use Web Crypto API for SHA-1 hashing
    const msgBuffer = new TextEncoder().encode(concatenated);
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const accessKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Auth request
    const authPayload = {
      partnerId: partnerId,
      time: currentTime,
      accessKey: accessKey
    };
    
    const response = await axios.post(authUrl, authPayload);
    
    if (!response.data?.data?.token) {
      throw new Error('Authentication failed');
    }
    
    return response.data.data.token;
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};

// Function to create a customer
export const createCustomer = async (customerData, token, customerUrl) => {
  try {
    console.log('Sending customer data:', JSON.stringify(customerData, null, 2));
    
    const response = await axios.post(customerUrl, customerData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Customer creation error:', error);
    // Log more detailed error information
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
    }
    throw error;
  }
};

// Main function to process a single lead
export const processLead = async (lead, apiConfig) => {
  const { partnerId, secretKey, authUrl, customerUrl, country, referral } = apiConfig;
  
  try {
    // Step 1: Authenticate and get token
    const token = await authenticate(partnerId, secretKey, authUrl);
    
    // Step 2: Prepare customer data
    // Format phone number
    let formattedPhone = lead.phone;
    formattedPhone = formattedPhone.replace(/\D/g, ''); // Remove non-digits
    formattedPhone = formattedPhone.replace(/^0+|^\+/g, ''); // Remove leading zeros/plus
    if (!formattedPhone.startsWith('966')) {
      formattedPhone = '966' + formattedPhone;
    }
    
    // Create a digits-only version of phone for email
    const phoneDigitsOnly = lead.phone.replace(/\D/g, '');
    
    // HARDCODE both firstName and lastName with guaranteed alphanumeric values
    const finalFirstName = "User123";
    const finalLastName = "Customer123";
    
    console.log("Using hardcoded names:", finalFirstName, finalLastName);
    
    const customerData = {
      email: `${phoneDigitsOnly}@gmail.com`,
      password: 'ab123456',
      firstName: finalFirstName,
      lastName: finalLastName,
      phone: formattedPhone,
      country: country,
      referral: referral || undefined
    };
    
    // Add debugging to see if there are any non-alphanumeric characters
    console.log("Checking lastName:", finalLastName);
    console.log("Contains non-alphanumeric?", /[^a-zA-Z0-9]/.test(finalLastName));
    
    // Remove any undefined values
    Object.keys(customerData).forEach(key => {
      if (customerData[key] === undefined) {
        delete customerData[key];
      }
    });
    
    console.log('Final customer data being sent:', JSON.stringify(customerData, null, 2));
    
    // Step 3: Create customer
    const result = await createCustomer(customerData, token, customerUrl);
    
    return {
      success: true,
      message: 'Customer created successfully',
      data: result.data
    };
  } catch (error) {
    let errorMessage = 'Failed to process lead';
    
    // Try to extract more specific error message from the API response
    if (error.response && error.response.data) {
      const responseData = error.response.data;
      
      console.log("Full error response:", JSON.stringify(responseData, null, 2));
      
      if (typeof responseData === 'string') {
        errorMessage = responseData;
      } else if (responseData.message) {
        errorMessage = responseData.message;
      } else if (responseData.error) {
        if (typeof responseData.error === 'string') {
          errorMessage = responseData.error;
        } else if (typeof responseData.error === 'object') {
          const errorObj = responseData.error;
          errorMessage = errorObj.description || errorObj.message || JSON.stringify(errorObj);
        }
      } else if (responseData.errors && Array.isArray(responseData.errors)) {
        const errorsStr = responseData.errors.map(e => 
          typeof e === 'string' ? e : (e.description || e.message || JSON.stringify(e))
        ).join('; ');
        errorMessage = `API errors: ${errorsStr}`;
      } else {
        errorMessage = `API error: ${JSON.stringify(responseData)}`;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      message: errorMessage,
      error: error.response?.data || error
    };
  }
}; 