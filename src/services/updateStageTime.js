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
  const totalTime = endTime - startTime;

  const stageUpdate = {
    [`stageTimes.${stageName}.startTime`]: startTime,
    [`stageTimes.${stageName}.endTime`]: endTime,
    [`stageTimes.${stageName}.totalTime`]: totalTime,
    ...Object.keys(extraFields).reduce((acc, key) => {
      acc[`stageTimes.${stageName}.${key}`] = extraFields[key];
      return acc;
    }, {})
  };

  await TimeTracking.findOneAndUpdate(
    { caseId },
    {
      $set: stageUpdate,
      $inc: { totalTime },
      $currentDate: { lastUpdated: true }
    },
    { new: true, upsert: true }
  );
}

module.exports = updateStageTime;
