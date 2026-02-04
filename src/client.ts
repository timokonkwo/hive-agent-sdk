import {
  createPublicClient,
  createWalletClient,
  http,
  PublicClient,
  WalletClient,
  Account
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { AUDIT_BOUNTY_ESCROW_ABI } from './contracts/abi'
import type { HiveClientConfig, Agent, Bounty, TransactionResult } from './types'

export class HiveClient {
  private publicClient: any
  private walletClient: any
  private account: Account
  private contractAddress: `0x${string}`

  constructor(config: HiveClientConfig) {
    this.contractAddress = config.contractAddress
    this.account = privateKeyToAccount(config.privateKey as `0x${string}`)

    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(config.rpcUrl)
    })

    this.walletClient = createWalletClient({
      chain: baseSepolia,
      transport: http(config.rpcUrl),
      account: this.account
    })
  }

  /**
   * Get the agent's wallet address
   */
  getAddress(): string {
    return this.account.address
  }

  /**
   * Register as an agent on the HIVE marketplace
   */
  async registerAgent(name: string, bio: string): Promise<TransactionResult> {
    try {
      const hash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'registerAgent',
        args: [name, bio],
        chain: baseSepolia
      })

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
      return { hash, success: receipt.status === 'success' }
    } catch (error) {
      console.error('Failed to register agent:', error)
      throw error
    }
  }

  /**
   * Get the current agent's profile
   */
  async getMyProfile(): Promise<Agent | null> {
    return this.getAgentProfile(this.account.address)
  }

  /**
   * Get an agent's profile by address
   */
  async getAgentProfile(address: string): Promise<Agent | null> {
    try {
      const [name, bio, wallet, isRegistered, registeredAt] = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'agents',
        args: [address as `0x${string}`]
      }) as [string, string, string, boolean, bigint]

      if (!isRegistered) return null

      const reputation = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'agentReputation',
        args: [address as `0x${string}`]
      }) as bigint

      return {
        address: wallet,
        name,
        bio,
        reputation,
        registeredAt,
        isRegistered
      }
    } catch (error) {
      console.error('Failed to get agent profile:', error)
      return null
    }
  }

  /**
   * Get all registered agents
   */
  async getAllAgents(): Promise<Agent[]> {
    try {
      const agents = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'getAllAgents'
      }) as Array<{ name: string; bio: string; wallet: string; isRegistered: boolean; registeredAt: bigint }>

      return Promise.all(
        agents.map(async (a) => {
          const reputation = await this.publicClient.readContract({
            address: this.contractAddress,
            abi: AUDIT_BOUNTY_ESCROW_ABI,
            functionName: 'agentReputation',
            args: [a.wallet as `0x${string}`]
          }) as bigint

          return {
            address: a.wallet,
            name: a.name,
            bio: a.bio,
            reputation,
            registeredAt: a.registeredAt,
            isRegistered: a.isRegistered
          }
        })
      )
    } catch (error) {
      console.error('Failed to get all agents:', error)
      return []
    }
  }

  /**
   * Get a bounty by ID
   */
  async getBounty(bountyId: bigint): Promise<Bounty | null> {
    try {
      const bounty = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'getBounty',
        args: [bountyId]
      }) as { client: string; amount: bigint; codeUri: string; isOpen: boolean; assignedAgent: string; reportUri: string; createdAt: bigint }

      return {
        id: bountyId,
        client: bounty.client,
        amount: bounty.amount,
        codeUri: bounty.codeUri,
        isOpen: bounty.isOpen,
        assignedAgent: bounty.assignedAgent,
        reportUri: bounty.reportUri,
        createdAt: bounty.createdAt
      }
    } catch (error) {
      console.error('Failed to get bounty:', error)
      return null
    }
  }

  /**
   * Get all open bounties
   */
  async getOpenBounties(): Promise<Bounty[]> {
    try {
      const counter = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'bountyCounter'
      }) as bigint

      const bounties: Bounty[] = []
      for (let i = 1n; i <= counter; i++) {
        const bounty = await this.getBounty(i)
        if (bounty && bounty.isOpen) {
          bounties.push(bounty)
        }
      }
      return bounties
    } catch (error) {
      console.error('Failed to get open bounties:', error)
      return []
    }
  }

  /**
   * Submit work for a bounty
   */
  async submitWork(bountyId: bigint, reportUri: string): Promise<TransactionResult> {
    try {
      const hash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'submitWork',
        args: [bountyId, reportUri],
        chain: baseSepolia
      })

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
      return { hash, success: receipt.status === 'success' }
    } catch (error) {
      console.error('Failed to submit work:', error)
      throw error
    }
  }
}
