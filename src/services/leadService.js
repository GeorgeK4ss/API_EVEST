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
    
    console.log("Auth payload:", {
      partnerId,
      time: currentTime,
      accessKey
    });
    
    // Auth request
    const authPayload = {
      partnerId: partnerId,
      time: currentTime,
      accessKey: accessKey
    };
    
    const response = await axios.post(authUrl, authPayload);
    console.log("Auth response:", response.data);
    
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
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
    }
    throw error;
  }
};

// Process a single lead
export const processLead = async (lead, apiConfig) => {
  const { partnerId, secretKey, authUrl, customerUrl, country, referral } = apiConfig;
  
  try {
    console.log("Processing lead:", lead);
    console.log("API config:", apiConfig);
    
    // Step 1: Authenticate and get token
    const token = await authenticate(partnerId, secretKey, authUrl);
    
    // Step 2: Format phone number
    let formattedPhone = lead.phone.replace(/\D/g, ''); // Remove non-digits
    formattedPhone = formattedPhone.replace(/^0+|^\+/g, ''); // Remove leading zeros/plus
    if (!formattedPhone.startsWith('966')) {
      formattedPhone = '966' + formattedPhone;
    }
    
    // Create email from phone
    const phoneDigitsOnly = lead.phone.replace(/\D/g, '');
    
    // Step 3: Create customer data with original names
    const customerData = {
      email: `${phoneDigitsOnly}@gmail.com`,
      password: 'ab123456',
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: formattedPhone,
      country: country,
      referral: referral || undefined
    };
    
    // If this still fails, we could try the direct format from the original API example:
    // const customerData = {
    //   email: `${phoneDigitsOnly}@gmail.com`,
    //   password: "ab123456",
    //   firstName: lead.firstName,
    //   lastName: lead.lastName,
    //   phone: formattedPhone,
    //   country: country,
    //   referral: referral
    // };
    
    // Remove any undefined values
    Object.keys(customerData).forEach(key => {
      if (customerData[key] === undefined) {
        delete customerData[key];
      }
    });
    
    console.log('Final customer data:', JSON.stringify(customerData, null, 2));
    
    // Step 4: Create customer
    const result = await createCustomer(customerData, token, customerUrl);
    
    return {
      success: true,
      message: 'Customer created successfully',
      data: result.data
    };
  } catch (error) {
    console.error("Full error:", error);
    let errorMessage = 'Failed to process lead';
    
    if (error.response && error.response.data) {
      const responseData = error.response.data;
      console.log("Error response data:", JSON.stringify(responseData, null, 2));
      
      if (responseData.error) {
        // Handle error object with error array
        errorMessage = responseData;
      } else if (Array.isArray(responseData)) {
        // Handle direct array
        errorMessage = responseData;
      } else if (typeof responseData === 'string') {
        // Handle string error
        errorMessage = responseData;
      } else if (responseData.message) {
        // Handle message object
        errorMessage = responseData.message;
      } else {
        // Default stringification
        errorMessage = JSON.stringify(responseData);
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.log("Final error message:", errorMessage);
    
    return {
      success: false,
      message: errorMessage
    };
  }
}; 