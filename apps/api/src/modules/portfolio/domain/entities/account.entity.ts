/**
 * Account Entity - Domain Layer
 *
 * Represents a brokerage account. Contains business rules
 * that are independent of any framework or database.
 */
export class AccountEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly broker: string,
    public readonly accountId: string,
    public readonly accountName: string | null,
    public readonly currency: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /**
   * Factory method to create entity from persistence data
   */
  static fromPersistence(data: {
    id: string;
    userId: string;
    broker: string;
    accountId: string;
    accountName: string | null;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
  }): AccountEntity {
    return new AccountEntity(
      data.id,
      data.userId,
      data.broker,
      data.accountId,
      data.accountName,
      data.currency,
      data.createdAt,
      data.updatedAt,
    );
  }

  /**
   * Get display name for the account
   */
  getDisplayName(): string {
    return this.accountName || `${this.capitalize(this.broker)} Account`;
  }

  /**
   * Check if account belongs to a specific user
   */
  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  /**
   * Check if this is a specific broker type
   */
  isBroker(broker: string): boolean {
    return this.broker.toLowerCase() === broker.toLowerCase();
  }

  /**
   * Get supported brokers list
   */
  static getSupportedBrokers(): string[] {
    return ['degiro', 'trade-republic', 'interactive-brokers', 'saxo', 'etoro'];
  }

  /**
   * Validate broker is supported
   */
  static isValidBroker(broker: string): boolean {
    return AccountEntity.getSupportedBrokers().includes(broker.toLowerCase());
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
