'use strict'

const tracks = require('db-platforms')
const { validateStation } = require('./validate')
const { osmInterchange } = require('./osm-interchange')
const { fetchFastaWithToken: _fetchFastaWithToken } = require('./osm-graph')

const defaults = {
	fastaToken: 'a756c74c732c9ec08c8c7618be55aa38'
}

const interchangeWithFetchFasta = fetchFastaWithToken => async (_from, _to, opt = {}) => {
	const options = Object.assign({}, defaults, opt)

	const { stationId: fromStationId, platform: fromPlatform } = validateStation(_from)
	const { stationId: toStationId, platform: toPlatform } = validateStation(_to)

	const fromTrack = tracks.find(track => track.station === fromStationId && track.name === fromPlatform)
	const toTrack = tracks.find(track => track.station === toStationId && track.name === toPlatform)
	if (!fromTrack || !toTrack) return null

	const { osmPlatform: fromOsm } = fromTrack
	const { osmPlatform: toOsm } = toTrack
	if (!fromOsm || !toOsm) return null

	return osmInterchange(fromOsm, toOsm, fetchFastaWithToken(options.fastaToken))
}

module.exports = interchangeWithFetchFasta(_fetchFastaWithToken)
module.exports.interchangeWithFetchFasta = interchangeWithFetchFasta
