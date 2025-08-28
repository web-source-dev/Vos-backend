const axios = require('axios');

// SignNow API configuration
const SIGNNOW_API_BASE_URL = 'https://api.signnow.com';
const SIGNNOW_ACCESS_TOKEN = process.env.SIGNNOW_API_KEY;

/**
 * Check the status of a SignNow document
 * @param {string} documentId - The SignNow document ID
 * @returns {Promise<Object>} - Document status information
 */
const checkDocumentStatus = async (documentId) => {
  try {
    console.log('Checking SignNow document status for:', documentId);
    
    if (!SIGNNOW_ACCESS_TOKEN) {
      throw new Error('SignNow API key not configured');
    }

    const response = await axios.get(`${SIGNNOW_API_BASE_URL}/document/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${SIGNNOW_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const documentData = response.data;
    
    // Debug: Log the full response structure to understand what we're working with
    console.log('Full SignNow API response structure:', {
      documentId,
      hasRequests: !!documentData.requests,
      requestsLength: documentData.requests?.length || 0,
      hasSignatures: !!documentData.signatures,
      signaturesLength: documentData.signatures?.length || 0,
      hasRoles: !!documentData.roles,
      rolesLength: documentData.roles?.length || 0,
      hasDeclined: !!documentData.declined,
      declinedLength: documentData.declined?.length || 0,
      availableKeys: Object.keys(documentData)
    });
    
    // Determine document status based on requests, roles, and signatures
    let documentStatus = 'pending';
    let isSigned = false;
    
    // Check if there are any requests (invites)
    if (documentData.requests && documentData.requests.length > 0) {
      const requests = documentData.requests;
      
      // Check if all requests are completed
      const allCompleted = requests.every(request => 
        request.status === 'completed' || request.status === 'signed'
      );
      
      // Check if any requests are declined
      const anyDeclined = requests.some(request => 
        request.status === 'declined' || request.status === 'canceled'
      );
      
      if (anyDeclined) {
        documentStatus = 'declined';
      } else if (allCompleted) {
        // Only mark as signed if there are exactly 2 signatures
        if (documentData.signatures && documentData.signatures.length === 2) {
          documentStatus = 'signed';
          isSigned = true;
        } else {
          documentStatus = 'partially_signed';
          isSigned = false;
        }
      } else {
        // Check individual request statuses
        const pendingRequests = requests.filter(request => 
          request.status === 'pending' || request.status === 'sent'
        );
        const completedRequests = requests.filter(request => 
          request.status === 'completed' || request.status === 'signed'
        );
        
        if (completedRequests.length > 0 && pendingRequests.length === 0) {
          // Only mark as signed if there are exactly 2 signatures
          if (documentData.signatures && documentData.signatures.length === 2) {
            documentStatus = 'signed';
            isSigned = true;
          } else {
            documentStatus = 'partially_signed';
            isSigned = false;
          }
        } else if (completedRequests.length > 0) {
          documentStatus = 'partially_signed';
          isSigned = false;
        } else {
          documentStatus = 'pending';
          isSigned = false;
        }
      }
    }
    
    // Alternative: Check if there are signatures and no pending requests
    if (documentData.signatures && documentData.signatures.length > 0) {
      const hasSignatures = documentData.signatures.length > 0;
      const hasPendingRequests = documentData.requests && 
        documentData.requests.some(request => 
          request.status === 'pending' || request.status === 'sent'
        );
      
      // Only mark as signed if there are exactly 2 signatures (fully signed)
      if (hasSignatures && !hasPendingRequests && documentData.signatures.length === 2) {
        documentStatus = 'signed';
        isSigned = true;
      } else if (hasSignatures && documentData.signatures.length === 1) {
        // One signature means partially signed
        documentStatus = 'partially_signed';
        isSigned = false;
      } else if (hasSignatures && documentData.signatures.length === 0) {
        // No signatures means pending
        documentStatus = 'pending';
        isSigned = false;
      }
    }
    
    // Check if document is declined
    if (documentData.declined && documentData.declined.length > 0) {
      documentStatus = 'declined';
      isSigned = false;
    }
    
    console.log('SignNow document status analysis:', {
      documentId,
      determinedStatus: documentStatus,
      isSigned,
      signatures: documentData.signatures?.length || 0,
      signatureCount: documentData.signatures?.length || 0,
      requests: documentData.requests?.length || 0,
      requestStatuses: documentData.requests?.map(r => r.status) || [],
      created: documentData.created,
      updated: documentData.updated,
      willDownload: documentData.signatures?.length === 2 && isSigned
    });

    return {
      success: true,
      documentId,
      status: documentStatus,
      signatures: documentData.signatures || [],
      requests: documentData.requests || [],
      created: documentData.created,
      updated: documentData.updated,
      documentName: documentData.document_name,
      pageCount: documentData.page_count,
      isSigned: isSigned,
      rawData: documentData
    };

  } catch (error) {
    console.error('Error checking SignNow document status:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return {
        success: false,
        error: 'Document not found',
        documentId
      };
    }
    
    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'Unauthorized - Invalid API credentials',
        documentId
      };
    }

    return {
      success: false,
      error: error.response?.data?.message || error.message,
      documentId
    };
  }
};

/**
 * Get download link for a signed SignNow document
 * @param {string} documentId - The SignNow document ID
 * @returns {Promise<Object>} - Download link information
 */
const getDocumentDownloadLink = async (documentId) => {
  try {
    console.log('Getting SignNow document download link for:', documentId);
    
    if (!SIGNNOW_ACCESS_TOKEN) {
      throw new Error('SignNow API key not configured');
    }

    const response = await axios.post(`${SIGNNOW_API_BASE_URL}/document/${documentId}/download/link`, {}, {
      headers: {
        'Authorization': `Bearer ${SIGNNOW_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const downloadData = response.data;
    
    console.log('SignNow download link response:', {
      documentId,
      hasLink: !!downloadData.link,
      linkLength: downloadData.link?.length || 0
    });

    return {
      success: true,
      documentId,
      downloadLink: downloadData.link,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Link typically expires in 24 hours
      rawData: downloadData
    };

  } catch (error) {
    console.error('Error getting SignNow document download link:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return {
        success: false,
        error: 'Document not found',
        documentId
      };
    }
    
    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'Unauthorized - Invalid API credentials',
        documentId
      };
    }

    if (error.response?.status === 400) {
      return {
        success: false,
        error: 'Document not ready for download (may not be signed yet)',
        documentId
      };
    }

    return {
      success: false,
      error: error.response?.data?.message || error.message,
      documentId
    };
  }
};

/**
 * Check document status and get download link if signed
 * @param {string} documentId - The SignNow document ID
 * @returns {Promise<Object>} - Combined status and download information
 */
const checkStatusAndGetDownloadLink = async (documentId) => {
  try {
    console.log('Checking status and getting download link for document:', documentId);
    
    // First check the document status
    const statusResult = await checkDocumentStatus(documentId);
    
    if (!statusResult.success) {
      return statusResult;
    }

    // If document is signed, get the download link
    if (statusResult.isSigned) {
      console.log('Document is signed, getting download link...');
      const downloadResult = await getDocumentDownloadLink(documentId);
      
      return {
        success: true,
        documentId,
        status: statusResult.status,
        isSigned: true,
        downloadLink: downloadResult.success ? downloadResult.downloadLink : null,
        downloadError: downloadResult.success ? null : downloadResult.error,
        signatures: statusResult.signatures,
        created: statusResult.created,
        updated: statusResult.updated,
        documentName: statusResult.documentName
      };
    }

    // Document is not signed yet
    return {
      success: true,
      documentId,
      status: statusResult.status,
      isSigned: false,
      downloadLink: null,
      signatures: statusResult.signatures,
      created: statusResult.created,
      updated: statusResult.updated,
      documentName: statusResult.documentName
    };

  } catch (error) {
    console.error('Error in checkStatusAndGetDownloadLink:', error);
    return {
      success: false,
      error: error.message,
      documentId
    };
  }
};

module.exports = {
  checkDocumentStatus,
  getDocumentDownloadLink,
  checkStatusAndGetDownloadLink
};
