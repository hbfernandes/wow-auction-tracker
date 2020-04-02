const https = require('https')
const Discord = require('discord.js')

function getBlizzToken() {
  const options = {
    hostname: 'eu.battle.net',
    path: '/oauth/token?grant_type=client_credentials',
    auth: `${process.env.BLIZZ_CLIENT_ID}:${process.env.BLIZZ_CLIENT_SECRET}`,
    method: 'GET'
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      console.log(`Get token: ${res.statusCode}`)
      if (res.statusCode !== 200) {
        reject(new Error(`Get token: ${res.statusCode}`))
      }

      res.on('data', data => {
        const result = JSON.parse(data)
        resolve(result.access_token)
      })
    })

    req.on('error', error => reject(error))
    req.end()
  })
}

function getAuctions(token, realm) {
  const options = {
    hostname: 'eu.api.blizzard.com',
    path: `/data/wow/connected-realm/${realm}/auctions?namespace=dynamic-eu&locale=en_US`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      console.log(`Get auctions: ${res.statusCode}`)
      if (res.statusCode !== 200) {
        reject(new Error(`Get auctions: ${res.statusCode}`))
      }
      res.setTimeout(600, () => reject(new Error('timed out')))

      let body = ''
      res.on('data', chunck => body += chunck)
      res.on('end', function () {
        const result = JSON.parse(body)
        resolve(result.auctions)
      })
    })

    req.on('error', error => reject(error))
    req.end()
  })
}

function getRealms(token) {
  // 1325: Aggramar, Hellscream

  const options = {
    hostname: 'eu.api.blizzard.com',
    path: `/data/wow/connected-realm/index?namespace=dynamic-eu&locale=en_US`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let body = ''
      res.on('data', chunck => body += chunck)
      res.on('end', function () {
        const result = JSON.parse(body)
        resolve(result.connected_realms)
      })
    })

    req.on('error', error => reject(error))
    req.end()
  })
}

function listNamesIDs(token, links) {
  links.forEach(link => {
    const options = {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }

    const req = https.get(`${link.href}&locale=en_US`, options, res => {
      let body = ''
      res.on('data', chunck => body += chunck)
      res.on('end', function () {
        const result = JSON.parse(body)
        console.log(`${result.id}: ${result.realms.map(realm => realm.name).join(', ')}`)
      })
    })

    req.on('error', error => reject(error))
    req.end()
  })
}

async function processItems(auctions) {
  console.log(`Processing ${auctions.length} auctions!`)

  const corruptions = new Map([
    [6471, 'Masterfull I'],
    [6472, 'Masterfull II'],
    [6473, 'Masterfull III']
  ])
  const items = new Map([
    [175009, 'Off-hand'],
    [175004, 'Legs'],
    [175008, 'Ring]']
  ])
  const ilvls = new Map([
    // [1472, 430],
    [1487, 445],
    [1502, 460],
    [1517, 475],
  ])

  const priceLimit = 550000

  let results = []
  auctions.forEach(auction => {
    if (items.has(auction.item.id)
      && auction.item.bonus_lists.some(bonus => corruptions.has(bonus))
      && auction.item.bonus_lists.some(bonus => ilvls.has(bonus))
      && (auction.buyout / 10000) < priceLimit
    ) {
      let corruption, ilvl

      auction.item.bonus_lists.forEach(bonus => {
        if (ilvls.has(bonus)) {
          ilvl = ilvls.get(bonus)
        }
        if (corruptions.has(bonus)) {
          corruption = corruptions.get(bonus)
        }
      })

      results.push(`${ilvl} ${items.get(auction.item.id)} - ${corruption} : ${auction.buyout / 10000}`)
    }
  })

  return results
}

async function discord(realm, items) {
  const hook = new Discord.WebhookClient(process.env.DISCORD_WEBHOOK_ID, process.env.DISCORD_WEBHOOK_TOKEN)
  const message = `[${realm} - ${new Date().toGMTString()}]\n${items.join('\n')}`

  console.log(message)
  hook.send(message)
  hook.destroy()
}

async function run() {
  const token = await getBlizzToken()

  const realms = new Map([
    [1096, 'Sporeggar'],
    [1325, 'Hellscream']
  ])

  realms.forEach(async (name, id) => {
    const auctions = await getAuctions(token, id)
    const items = await processItems(auctions)

    if (items.length) discord(name, items)
  })
}

async function listRealms() {
  const token = await getBlizzToken()
  const links = await getRealms(token)
  listNamesIDs(token, links)
}

// listRealms().catch(error => console.error(error))
run().catch(error => console.error(error))

