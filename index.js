const https = require('https')

// 1325: Aggramar, Hellscream

async function run() {
  const options = {
    hostname: 'eu.battle.net',
    path: '/oauth/token?grant_type=client_credentials',
    auth: `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`,
    method: 'GET'
  }

  const req = https.request(options, res => {
    console.log(`Get token: ${res.statusCode}`)

    res.on('data', data => {
      const result = JSON.parse(data)
      retrieveData(result.access_token)
    })
  })

  req.on('error', error => {
    console.error(error)
    process.exit(1)
  })

  req.end()
}

async function retrieveData(token) {
  const options = {
    hostname: 'eu.api.blizzard.com',
    path: `/data/wow/connected-realm/1325/auctions?namespace=dynamic-eu&locale=en_US`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }

  const req = https.request(options, res => {
    console.log(`Get auctions: ${res.statusCode}`)

    let body = ''
    res.on('data', chunck => {
      body += chunck
    })
    res.on('end', function () {
      const result = JSON.parse(body)
      processItems(result.auctions)
    })
  })

  req.on('error', error => {
    console.error(error)
    process.exit(1)
  })

  req.end()
}

async function processItems(auctions) {
  console.log(`Found ${auctions.length} auctions!`)
  let corruptions = [
    6471, 6472, 6473 // masterfull
  ]

  let items = {
    175009: [], // offhand
    175004: [], // legs
    175008: []  // ring
  }
  let ids = [175009, 175004, 175008]

  auctions.forEach(auction => {
    if (ids.includes(auction.item.id) && auction.item.bonus_lists.some(bonus => corruptions.includes(bonus))) {
      items[auction.item.id].push(auction.item)
    }
  })

  console.log(items)
}


run().catch(e => {
  console.error(e)
  process.exit(1)
})


