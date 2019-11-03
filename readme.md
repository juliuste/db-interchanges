# db-interchanges

Retrieve accessibility information for interchanges between specific platforms at Deutsche Bahn (DB) stations. *This module is still an early prototype, feel free to test and play around, but you shouldn't let people rely on it. See also: [Coverage and potential problems](#coverage-and-potential-problems).*

[![npm version](https://img.shields.io/npm/v/db-interchanges.svg)](https://www.npmjs.com/package/db-interchanges)
[![Build status](https://travis-ci.org/juliuste/db-interchanges.svg?branch=master)](https://travis-ci.org/juliuste/db-interchanges)
[![Greenkeeper badge](https://badges.greenkeeper.io/juliuste/db-interchanges.svg)](https://greenkeeper.io/)
[![License](https://img.shields.io/github/license/juliuste/db-interchanges.svg?style=flat)](license)

## Installation and usage

```bash
npm install db-interchanges
```

**Warning: This module is a very early prototype, so most methods are quite inefficient and slow. Note also that requesting interchange information will spawn a request to the *[Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)*, which sometimes takes a couple of seconds to respond.**

```js
const fetchInterchangeInformation = require('db-interchanges')

// leipzig messe, platform 3
const from = {
    stationId: '8012478'
    platform: '3'
}

// leipzig messe, platform 2
const to = {
    stationId: '8012478'
    platform: '2'
}

const opt = {
    fastaToken: '…' // token for the db fasta elevator api. the library provides a default token, but this is likely to be rate-limited if used by a lot of people. you can get your own one here: https://developer.deutschebahn.com/store/apis/info?name=FaSta-Station_Facilities_Status&version=v2&provider=DBOpenData
}

fetchInterchangeInformation(from, to, opt)
    .then(console.log)
    .catch(console.error)
```

### Responses

`fetchInterChangeInformation` will return the following responses

response|situation
--------|---------
`null` | The [`db-perrons`](https://github.com/juliuste/db-perrons) module doesn't contain any information for the specified platform(s), *see also [Coverage and potential problems](#coverage-and-potential-problems)*.
`{ barrierFree: true, elevators:[] }` | The module found a barrier-free route for the interchange that **doesn't require using any elevators**.
`{ barrierFree: true, elevators: ['123456789']} ` | The module found a barrier-free route that requires using the elevators with given FaSta ids *(see also [db-elevators](https://github.com/juliuste/db-elevators))*, which are **all currently working correctly according to the FaSta API**.
`{ barrierFree: null, elevators: ['123456789']} ` | The module found a barrier-free route that requires using the elevators with given FaSta ids *see also [db-elevators](https://github.com/juliuste/db-elevators)*, for which the **FaSta API returned status *working* or *unknown*, but *not broken***.
`{ barrierFree: false ` | There either is **no barrier-free route at all** or an elevator that would make this route barrier-free is **currently broken according to the FaSta API**.

## Coverage and potential problems

When looking up interchange information, `db-interchanges` first tries to look up the specified platforms using [db-perrons](https://github.com/juliuste/db-perrons). Any interchange for which not both platforms are tagged with OSM data in `db-perrons`, `db-interchanges` will be unable to determine any accessibility information. See [this list](https://github.com/juliuste/db-perrons/blob/master/todo.md) for an overview of the current coverage level in `db-perrons`. 

Note that - as OSM ids are not guaranteed to be stable forever - `db-perrons` may contain entries that are not valid anymore. This will have the same effect as if a station hadn't been tagged in `db-perrons` in the first place, so take the coverage list mentioned above with a grain of salt.

After looking up platforms, `db-interchanges` fetches data from the [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API), which might take some seconds. The module will then try to calculate routes between the `from` and `to` platforms specified by the user. It filters out any elevators which are tagged on OpenStreetMap but are not included in [db-elevators](https://github.com/juliuste/db-elevators). See [this list](https://github.com/juliuste/db-elevators/blob/master/todo.md) for an overview of the current coverage level in `db-elevators`.

The algorithm also fetches the FaSta API for any matched elevators and filters out any broken ones and returns the corresponding `barrierFree` information *(see also [Responses](#responses)).*

## Contributing

If you found a bug or want to propose a feature, feel free to visit [the issues page](https://github.com/juliuste/db-interchanges/issues).
