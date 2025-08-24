const axios = require('axios');

class ZapierService {
  constructor() {
    this.webhookUrl = "https://hooks.zapier.com/hooks/catch/24284026/utxb0pa/";
    this.defaultAttendees = [
      'amy.livelsberger@vinonspot.com',
      'olajahwon.michael@vinonspot.com', 
      'amy.figueroa@vinonspot.com'
    ];
  }

  /**
   * Send inspection scheduling webhook to Zapier
   */
  async scheduleInspection(inspection, caseData, isReschedule = false) {
    console.log('=== ZAPIER WEBHOOK START ===');
    console.log('Webhook URL:', this.webhookUrl);
    console.log('Is Reschedule:', isReschedule);
    console.log('Inspection ID:', inspection._id);
    console.log('Case ID:', caseData._id);
    
    if (!this.webhookUrl) {
      console.warn('Zapier webhook URL not configured. Skipping calendar event creation.');
      return;
    }

    try {
      const eventData = this.buildCalendarEventData(inspection, caseData, isReschedule);
      
      console.log('=== ZAPIER WEBHOOK DATA ===');
      console.log('Full event data being sent to Zapier:');
      console.log(JSON.stringify(eventData, null, 2));
      
      console.log('=== ZAPIER WEBHOOK REQUEST ===');
      console.log('URL:', this.webhookUrl);
      console.log('Method: POST');
      console.log('Headers:', {
        'Content-Type': 'application/json',
      });
      console.log('Timeout: 10000ms');

      const response = await axios.post(this.webhookUrl, eventData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      console.log('=== ZAPIER WEBHOOK RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Response Headers:', response.headers);
      console.log('Response Data:', JSON.stringify(response.data, null, 2));
      console.log('=== ZAPIER WEBHOOK SUCCESS ===');

      return response.data;
    } catch (error) {
      console.log('=== ZAPIER WEBHOOK ERROR ===');
      console.error('Error sending Zapier webhook:');
      console.error('Error Message:', error.message);
      console.error('Error Code:', error.code);
      console.error('Error Stack:', error.stack);
      
      if (error.response) {
        console.error('Response Status:', error.response.status);
        console.error('Response Status Text:', error.response.statusText);
        console.error('Response Headers:', error.response.headers);
        console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error('Request was made but no response received');
        console.error('Request:', error.request);
      } else {
        console.error('Error setting up request:', error.message);
      }
      
      console.error('Inspection ID:', inspection._id);
      console.error('Case ID:', caseData._id);
      console.log('=== ZAPIER WEBHOOK ERROR END ===');
      
      // Don't throw error - we don't want to fail the inspection scheduling if Zapier is down
      return null;
    }
  }

  /**
   * Build calendar event data for Zapier
   */
  buildCalendarEventData(inspection, caseData, isReschedule = false) {
    console.log('=== BUILDING CALENDAR EVENT DATA ===');
    console.log('Input inspection:', {
      scheduledDate: inspection.scheduledDate,
      scheduledTime: inspection.scheduledTime,
      inspector: inspection.inspector
    });
    console.log('Input caseData:', {
      customer: caseData.customer,
      vehicle: caseData.vehicle,
      estimatorId: caseData.estimatorId
    });
    
    const scheduledDate = new Date(inspection.scheduledDate);
    const scheduledTime = inspection.scheduledTime;
    
    console.log('Parsed scheduledDate:', scheduledDate);
    console.log('Original scheduledTime:', scheduledTime);
    
    // Parse time (assuming format like "09:00" or "2:30 PM")
    const [hours, minutes] = this.parseTime(scheduledTime);
    console.log('Parsed time - hours:', hours, 'minutes:', minutes);
    
    const startDateTime = new Date(scheduledDate);
    startDateTime.setHours(hours, minutes, 0, 0);
    
    // End time is 2 hours after start time (adjustable)
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 2);
    
    console.log('Calculated startDateTime:', startDateTime);
    console.log('Calculated endDateTime:', endDateTime);

    // Build attendee list
    const attendees = [...this.defaultAttendees];
    console.log('Default attendees:', this.defaultAttendees);
    
    // Add inspector if they have an email
    if (inspection.inspector?.email) {
      attendees.push(inspection.inspector.email);
      console.log('Added inspector email:', inspection.inspector.email);
    }

    // Add estimator if assigned
    if (caseData.estimatorId) {
      // We'll need to fetch the estimator's email from the database
      // For now, we'll add a placeholder that Zapier can handle
      attendees.push('estimator@vinonspot.com');
      console.log('Added estimator placeholder email');
    }
    
    console.log('Final attendees list:', attendees);

    const eventData = {
      action: isReschedule ? 'reschedule_inspection' : 'schedule_inspection',
      inspection_id: inspection._id.toString(),
      case_id: caseData._id.toString(),
      customer: {
        name: `${caseData.customer?.firstName || ''} ${caseData.customer?.lastName || ''}`.trim(),
        email: caseData.customer?.email1 || '',
        phone: caseData.customer?.cellPhone || ''
      },
      vehicle: {
        year: caseData.vehicle?.year || '',
        make: caseData.vehicle?.make || '',
        model: caseData.vehicle?.model || '',
        vin: caseData.vehicle?.vin || '',
        color: caseData.vehicle?.color || ''
      },
      inspector: {
        name: `${inspection.inspector?.firstName || ''} ${inspection.inspector?.lastName || ''}`.trim(),
        email: inspection.inspector?.email || '',
        phone: inspection.inspector?.phone || ''
      },
      appointment: {
        date: scheduledDate.toISOString().split('T')[0], // YYYY-MM-DD
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        time_zone: 'America/Chicago', // Default timezone
        notes: inspection.notesForInspector || ''
      },
      calendar_events: {
        inspector_event: {
          title: `Vehicle Inspection - ${caseData.customer?.firstName || 'Customer'} ${caseData.customer?.lastName || ''}`,
          description: this.buildInspectorEventDescription(inspection, caseData),
          location: 'Customer Location', // This could be made dynamic
          attendees: attendees,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          calendar: 'Inspector Calendar',
          color: '#4285F4' // Blue for inspector events
        },
        estimator_event: {
          title: `Estimator Standby - ${caseData.customer?.firstName || 'Customer'} ${caseData.customer?.lastName || ''}`,
          description: this.buildEstimatorEventDescription(inspection, caseData),
          location: 'Office',
          attendees: attendees,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          calendar: 'Estimator Calendar', 
          color: '#34A853' // Green for estimator events
        }
      },
      metadata: {
        created_at: inspection.createdAt,
        updated_at: new Date().toISOString(),
        status: inspection.status,
        access_token: inspection.accessToken
      }
    };

    console.log('=== FINAL EVENT DATA STRUCTURE ===');
    console.log('Action:', eventData.action);
    console.log('Inspection ID:', eventData.inspection_id);
    console.log('Case ID:', eventData.case_id);
    console.log('Customer:', eventData.customer);
    console.log('Vehicle:', eventData.vehicle);
    console.log('Inspector:', eventData.inspector);
    console.log('Appointment:', eventData.appointment);
    console.log('Inspector Event Title:', eventData.calendar_events.inspector_event.title);
    console.log('Estimator Event Title:', eventData.calendar_events.estimator_event.title);
    console.log('=== END BUILDING CALENDAR EVENT DATA ===');

    return eventData;
  }

  /**
   * Parse time string to hours and minutes
   */
  parseTime(timeString) {
    if (!timeString) return [9, 0]; // Default to 9:00 AM
    
    // Handle 24-hour format (e.g., "14:30")
    if (timeString.includes(':')) {
      const [hours, minutes] = timeString.split(':').map(Number);
      return [hours || 9, minutes || 0];
    }
    
    // Handle 12-hour format (e.g., "2:30 PM")
    const timeMatch = timeString.match(/(\d+):?(\d*)\s*(AM|PM)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]) || 0;
      const period = timeMatch[3].toUpperCase();
      
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      return [hours, minutes];
    }
    
    return [9, 0]; // Default fallback
  }

  /**
   * Build description for inspector calendar event
   */
  buildInspectorEventDescription(inspection, caseData) {
    return `Vehicle Inspection Appointment

Customer: ${caseData.customer?.firstName || ''} ${caseData.customer?.lastName || ''}
Phone: ${caseData.customer?.cellPhone || 'N/A'}
Email: ${caseData.customer?.email1 || 'N/A'}

Vehicle: ${caseData.vehicle?.year || ''} ${caseData.vehicle?.make || ''} ${caseData.vehicle?.model || ''}
VIN: ${caseData.vehicle?.vin || 'N/A'}
Color: ${caseData.vehicle?.color || 'N/A'}

Notes: ${inspection.notesForInspector || 'No additional notes'}

Case ID: ${caseData._id}
Inspection ID: ${inspection._id}`;
  }

  /**
   * Build description for estimator calendar event
   */
  buildEstimatorEventDescription(inspection, caseData) {
    return `Estimator Standby - Vehicle Inspection

Customer: ${caseData.customer?.firstName || ''} ${caseData.customer?.lastName || ''}
Phone: ${caseData.customer?.cellPhone || 'N/A'}

Vehicle: ${caseData.vehicle?.year || ''} ${caseData.vehicle?.make || ''} ${caseData.vehicle?.model || ''}
VIN: ${caseData.vehicle?.vin || 'N/A'}

Inspector: ${inspection.inspector?.firstName || ''} ${inspection.inspector?.lastName || ''}

Standby for inspection completion and quote preparation.

Case ID: ${caseData._id}
Inspection ID: ${inspection._id}`;
  }
}

module.exports = new ZapierService();
