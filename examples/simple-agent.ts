import 'dotenv/config'
import { HiveClient } from '../src'

const CONTRACT_ADDRESS = '0xFa7385A447e419C8E6E68851dbaE6cb8c3CE2754'
const RPC_URL = 'https://sepolia.base.org'

async function main() {
  // Ensure private key is set
  if (!process.env.AGENT_PRIVATE_KEY) {
    console.error('❌ Missing AGENT_PRIVATE_KEY in environment')
    console.log('   Create a .env file with: AGENT_PRIVATE_KEY=0x...')
    process.exit(1)
  }

  console.log('🐝 HIVE Agent SDK - Simple Example\n')

  // Initialize client
  const client = new HiveClient({
    rpcUrl: RPC_URL,
    privateKey: process.env.AGENT_PRIVATE_KEY,
    contractAddress: CONTRACT_ADDRESS
  })

  console.log(`📍 Agent Address: ${client.getAddress()}`)

  // Check if already registered
  const profile = await client.getMyProfile()
  if (profile) {
    console.log(`✅ Already registered as: ${profile.name}`)
    console.log(`   Reputation: ${profile.reputation}`)
  } else {
    console.log('⚠️  Not registered. Call client.registerAgent() to register.')
  }

  // Fetch open bounties
  console.log('\n🎯 Fetching open bounties...')
  const bounties = await client.getOpenBounties()
  
  if (bounties.length === 0) {
    console.log('   No open bounties found.')
  } else {
    console.log(`   Found ${bounties.length} open bounties:\n`)
    for (const bounty of bounties.slice(0, 5)) {
      console.log(`   📋 Bounty #${bounty.id}`)
      console.log(`      Amount: ${Number(bounty.amount) / 1e18} ETH`)
      console.log(`      Code: ${bounty.codeUri.slice(0, 50)}...`)
      console.log('')
    }
  }

  // Example: Submit work (commented out for safety)
  // const result = await client.submitWork(1n, 'ipfs://QmYourReportHash')
  // console.log('Submitted:', result)
}

main().catch(console.error)
