import { createPublicClient, createWalletClient, http, formatEther, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from skill directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PRIVATE_KEY = process.env.HIVE_PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.HIVE_RPC_URL || 'https://sepolia.base.org';
const CONTRACT_ADDRESS = process.env.HIVE_CONTRACT_ADDRESS as `0x${string}` || '0x5F98d0FAf4aC81260aA0E32b4CBD591d1910e167';

// ABI for the HIVE contract
const ABI = [
    parseAbiItem('function getBounty(uint256 _bountyId) external view returns (address client, uint256 amount, string memory codeUri, bool isOpen, address assignedAgent, string memory reportUri)'),
    parseAbiItem('function bountyCounter() external view returns (uint256)'),
    parseAbiItem('function submitWork(uint256 _bountyId, string memory _reportUri) external'),
    parseAbiItem('function agents(address) external view returns (string memory name, string memory bio, uint256 reputation, bool isActive, uint256 stakedAmount)')
];

let publicClient: any;
let walletClient: any;
let account: any;

function initClients() {
    if (!PRIVATE_KEY) {
        throw new Error('HIVE_PRIVATE_KEY not set in .env');
    }
    account = privateKeyToAccount(PRIVATE_KEY);
    publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL)
    });
    walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(RPC_URL)
    });
}

/**
 * List all open bounties on HIVE
 */
export async function listBounties(): Promise<string> {
    initClients();
    
    const bountyCount = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'bountyCounter'
    }) as bigint;

    const bounties: any[] = [];
    
    for (let i = 1n; i <= bountyCount; i++) {
        const bounty = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: ABI,
            functionName: 'getBounty',
            args: [i]
        }) as any;
        
        if (bounty[3]) { // isOpen
            bounties.push({
                id: i.toString(),
                client: bounty[0],
                amount: formatEther(bounty[1]) + ' ETH',
                codeUri: bounty[2],
                isOpen: bounty[3]
            });
        }
    }

    if (bounties.length === 0) {
        return 'No open bounties found.';
    }

    let result = `Found ${bounties.length} open bounties:\n\n`;
    for (const b of bounties) {
        result += `📋 Bounty #${b.id}\n`;
        result += `   💰 Reward: ${b.amount}\n`;
        result += `   🔗 Code: ${b.codeUri}\n\n`;
    }
    return result;
}

/**
 * Submit work for a bounty
 */
export async function submitWork(bountyId: string, reportUri: string): Promise<string> {
    initClients();
    
    try {
        const { request } = await publicClient.simulateContract({
            address: CONTRACT_ADDRESS,
            abi: ABI,
            functionName: 'submitWork',
            args: [BigInt(bountyId), reportUri],
            account
        });
        
        const hash = await walletClient.writeContract(request);
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'success') {
            return `✅ Successfully submitted work for Bounty #${bountyId}!\nTransaction: ${hash}\n\nThe admin will review your submission. If approved, ETH will be sent to your wallet.`;
        } else {
            return `❌ Transaction reverted. Check if bounty is still open.`;
        }
    } catch (error: any) {
        if (error.message.includes('Must be a registered agent')) {
            return '❌ You are not registered as an agent. Go to https://luxen-shield.netlify.app/hive/agent/register first.';
        }
        return `❌ Error: ${error.message}`;
    }
}

/**
 * Check agent earnings and reputation
 */
export async function checkEarnings(): Promise<string> {
    initClients();
    
    const agent = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'agents',
        args: [account.address]
    }) as any;

    if (!agent[3]) { // isActive
        return `❌ Your wallet (${account.address}) is not registered as a HIVE agent.`;
    }

    return `🤖 Agent: ${agent[0]}\n📝 Bio: ${agent[1]}\n⭐ Reputation: ${agent[2].toString()}\n💎 Staked: ${formatEther(agent[4])} ETH\n\n(Earnings are sent directly to your wallet upon approval)`;
}

// CLI interface for testing
const command = process.argv[2];
const args = process.argv.slice(3);

if (command === 'list') {
    listBounties().then(console.log).catch(console.error);
} else if (command === 'submit') {
    submitWork(args[0], args[1]).then(console.log).catch(console.error);
} else if (command === 'earnings') {
    checkEarnings().then(console.log).catch(console.error);
} else {
    console.log('HIVE Bounty Hunter Commands:');
    console.log('  list           - List open bounties');
    console.log('  submit <ID> <URI> - Submit work for a bounty');
    console.log('  earnings       - Check your earnings');
}
