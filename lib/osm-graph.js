'use strict'

const graphlib = require('graphlib')
const get = require('lodash/get')
const intersection = require('lodash/intersection')
const { point: createPoint } = require('@turf/helpers')
const calculateDistance = require('@turf/distance').default
const got = require('got')
const dbElevators = require('db-elevators')

// @todo
// see https://wiki.openstreetmap.org/wiki/OSM_tags_for_routing/Valhalla
const isAllowed = (way, { allowSteps = true }) => {
	const access = get(way, 'tags.access') || ''
	const foot = get(way, 'tags.foot') || ''
	const pedestrian = get(way, 'tags.pedestrian') || ''
	if (intersection(['no', 'agricultural', 'discouraged', 'forestry', 'official'], [
		access.trim().toLowerCase(),
		foot.trim().toLowerCase(),
		pedestrian.trim().toLowerCase()
	]).length !== 0) return false

	const highway = get(way, 'tags.highway') || ''
	const conveying = get(way, 'tags.conveying') === 'yes'
	const incline = get(way, 'tags.incline')
	const wheelchair = get(way, 'tags.wheelchair')
	if (highway === 'steps' && !allowSteps) return false
	if (['motorway', 'motorway_link', 'undefined', 'unknown', 'bridleway', 'construction', 'cycleway', 'bus_guideway']
		.includes(highway.trim().toLowerCase())) return false
	if (highway === 'steps' && conveying) return false // @todo
	if (incline && conveying) return false // @todo

	if (wheelchair === 'no' && !allowSteps) return false
	if (incline && wheelchair !== 'yes' && !allowSteps) return false // @todo

	return true
}

// @todo fetch only if matching id was detected, submit specific fasta ids in request
const fetchFastaWithToken = token => async () => {
	const resource = 'https://api.deutschebahn.com/fasta/v2/facilities'
	const { body: data } = await got.get(resource, {
		json: true,
		headers: {
			Authorization: `Bearer ${token}`
		}
	})
	return data
}

const addFastaStatus = async (elevators, fetchFasta) => {
	const data = await fetchFasta()
	return elevators
		.map(elevator => {
			const fastaStatus = get(data.find(e => String(e.equipmentnumber) === elevator.dbId), 'state')
			return { ...elevator, status: fastaStatus ? fastaStatus.toLowerCase() : null }
		})
		.filter(e => !!e.status)
}

const addDbElevatorId = elevators => {
	return elevators
		.map(elevator => {
			const dbElevator = dbElevators.find(e => e.osmNodeId === String(elevator.id))
			return { ...elevator, dbId: get(dbElevator, 'id') }
		})
		.filter(e => !!e.dbId)
}

const removeEdgesBy = (graph, filter) => {
	// clone graph
	const newGraph = graphlib.json.read(graphlib.json.write(graph))
	newGraph.edges().forEach(({ v, w }) => {
		const edge = newGraph.edge(v, w)
		if (filter(edge)) newGraph.removeEdge(v, w)
	})
	return newGraph
}

const buildOsmGraphs = async (waysAndNodes, fetchFasta) => {
	const ways = waysAndNodes.filter(f => f.type === 'way' && isAllowed(f, { allowSteps: false }))

	const elevators = waysAndNodes.filter(f => f.type === 'node' && get(f, 'tags.highway') === 'elevator')
	const elevatorsWithDbId = addDbElevatorId(elevators)
	const elevatorsWithStatus = await addFastaStatus(elevatorsWithDbId, fetchFasta)

	const graph = new graphlib.Graph({ directed: false })

	ways.forEach(way => {
		way.nodes.forEach((node, index) => {
			if (index === 0) return
			const previousIndex = index - 1
			const previousNode = way.nodes[previousIndex]

			const coordinates = way.geometry[index]
			const point = createPoint([coordinates.lon, coordinates.lat])
			const previousCoordinates = way.geometry[previousIndex]
			const previousPoint = createPoint([previousCoordinates.lon, previousCoordinates.lat])
			const distance = calculateDistance(point, previousPoint)

			const nodeInGraph = graph.node(String(node))
			if (!nodeInGraph) graph.setNode(String(node), coordinates)
			const previousNodeInGraph = graph.node(String(previousNode))
			if (!previousNodeInGraph) graph.setNode(String(previousNode), previousCoordinates)

			graph.setEdge(String(node), String(previousNode), { weight: distance })
		})
	})

	elevators.forEach(node => {
		const withStatus = elevatorsWithStatus.find(e => String(e.id) === String(node.id))

		const edges = graph.nodeEdges(String(node.id))
		if (!edges) return
		edges.forEach(({ v, w }) => {
			const edge = graph.edge(v, w)
			if (withStatus && withStatus.status !== 'inactive') {
				graph.setEdge(v, w, {
					...edge,
					elevator: true,
					elevatorStatus: withStatus.status,
					elevatorId: withStatus.dbId
				})
			} else {
				graph.removeEdge(v, w)
			}
		})
	})

	return {
		activeAndUnknown: graph,
		onlyActive: removeEdgesBy(graph, edge => edge.elevator && edge.elevatorStatus !== 'active')
	}
}

module.exports = {
	fetchFastaWithToken,
	buildOsmGraphs
}
