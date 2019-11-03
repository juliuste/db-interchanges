'use strict'

const ow = require('ow')
const isUicCode = require('is-uic-location-code')

const stationInput = ow.object.exactShape({
	stationId: ow.string,
	platform: ow.string
})

const removeLeadingZeros = id => id.replace(/(?=^)[0]+/gi, '')

const validateStation = station => {
	ow(station, stationInput)
	const { stationId, platform } = station
	const cleanedStationId = removeLeadingZeros(stationId)
	if (!isUicCode(cleanedStationId)) throw new Error('station must be a valid UIC location code')
	return { stationId: cleanedStationId, platform }
}

module.exports = { validateStation }
