// utils/updateStageTime.js

const TimeTracking = require('../models/TimeTracking'); // adjust path if needed

/**
 * Updates a specific stage's time data in the TimeTracking document.
 * 
 * @param {String} caseId - The ID of the case.
 * @param {String} stageName - One of the defined stage keys (e.g., 'intake', 'inspection', etc.).
 * @param {Date} startTime - Start time of the stage.
 * @param {Date} endTime - End time of the stage.
 * @param {Object} extraFields - Optional. Additional fields like inspectorId or inspectorName.
 */
async function updateStageTime(caseId, stageName, startTime, endTime, extraFields = {}) {
  // Use the totalTime from extraFields if provided, otherwise calculate from start/end
  const totalTime = extraFields.totalTime || (endTime - startTime);

  const stageUpdate = {
    [`stageTimes.${stageName}.startTime`]: startTime,
    [`stageTimes.${stageName}.endTime`]: endTime,
    [`stageTimes.${stageName}.totalTime`]: totalTime,
    ...Object.keys(extraFields).reduce((acc, key) => {
      acc[`stageTimes.${stageName}.${key}`] = extraFields[key];
      return acc;
    }, {})
  };

  // Get existing document to calculate the correct total time
  const existingDoc = await TimeTracking.findOne({ caseId });
  
  if (existingDoc) {
    // Calculate the new total by replacing the old stage time with the new total time
    const oldStageTime = existingDoc.stageTimes[stageName]?.totalTime || 0;
    const newTotalTime = existingDoc.totalTime - oldStageTime + totalTime;
    
    await TimeTracking.findOneAndUpdate(
      { caseId },
      {
        $set: {
          ...stageUpdate,
          totalTime: newTotalTime
        },
        $currentDate: { lastUpdated: true }
      },
      { new: true, upsert: true }
    );
  } else {
    // If no existing document, create new one with the total time
    await TimeTracking.findOneAndUpdate(
      { caseId },
      {
        $set: {
          ...stageUpdate,
          totalTime: totalTime
        },
        $currentDate: { lastUpdated: true }
      },
      { new: true, upsert: true }
    );
  }
}

module.exports = updateStageTime;
