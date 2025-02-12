import { KMS } from 'aws-sdk';  // v2.1.0
import * as crypto from 'crypto';  // built-in
import { Logger } from './logger';

// Interfaces for encryption service
interface EncryptionConfig {
  region: string;
  keyId: string;
  keyTTL: number;
  enableCache?: boolean;
}

interface EncryptionOptions {
  algorithm?: string;
  keyId?: string;
}

interface EncryptionResult {
  data: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyId: string;
  algorithm: string;
  timestamp: number;
}

interface CachedKey {
  key: Buffer;
  timestamp: number;
}

/**
 * Enterprise-grade encryption service implementing AES-256 encryption
 * with AWS KMS integration and performance optimization
 */
export class EncryptionService {
  private readonly kmsClient: KMS;
  private readonly logger: Logger;
  private readonly keyCache: Map<string, CachedKey>;
  private readonly config: EncryptionConfig;
  private static readonly DEFAULT_ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;

  constructor(config: EncryptionConfig) {
    this.config = {
      enableCache: true,
      keyTTL: 3600000, // 1 hour default TTL
      ...config
    };

    this.kmsClient = new KMS({
      region: this.config.region,
      apiVersion: '2014-11-01'
    });

    this.logger = new Logger('EncryptionService', {
      maskFields: ['data', 'key', 'authTag']
    });

    this.keyCache = new Map<string, CachedKey>();
    this.validateConfiguration();
  }

  /**
   * Validates the service configuration and KMS access
   */
  private async validateConfiguration(): Promise<void> {
    try {
      await this.kmsClient.describeKey({
        KeyId: this.config.keyId
      }).promise();
    } catch (error) {
      this.logger.error('KMS key validation failed', { error });
      throw new Error('Invalid KMS configuration');
    }
  }

  /**
   * Retrieves encryption key from cache or KMS
   */
  private async getEncryptionKey(keyId: string): Promise<Buffer> {
    if (this.config.enableCache) {
      const cachedKey = this.keyCache.get(keyId);
      if (cachedKey && (Date.now() - cachedKey.timestamp) < this.config.keyTTL) {
        return cachedKey.key;
      }
    }

    try {
      const { Plaintext } = await this.kmsClient.generateDataKey({
        KeyId: keyId,
        KeySpec: 'AES_256'
      }).promise();

      if (!Plaintext) {
        throw new Error('Failed to generate data key');
      }

      const key = Buffer.from(Plaintext);

      if (this.config.enableCache) {
        this.keyCache.set(keyId, {
          key,
          timestamp: Date.now()
        });
      }

      return key;
    } catch (error) {
      this.logger.error('Failed to retrieve encryption key', { error, keyId });
      throw error;
    }
  }

  /**
   * Encrypts data using AES-256-GCM with performance optimization
   */
  public async encrypt(
    data: string,
    options: EncryptionOptions = {}
  ): Promise<EncryptionResult> {
    const algorithm = options.algorithm || EncryptionService.DEFAULT_ALGORITHM;
    const keyId = options.keyId || this.config.keyId;

    try {
      // Generate a random IV
      const iv = crypto.randomBytes(EncryptionService.IV_LENGTH);
      
      // Get encryption key
      const key = await this.getEncryptionKey(keyId);

      // Create cipher
      const cipher = crypto.createCipheriv(algorithm, key, iv, {
        authTagLength: EncryptionService.AUTH_TAG_LENGTH
      });

      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final()
      ]);

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      this.logger.info('Data encrypted successfully', {
        algorithm,
        keyId,
        dataLength: data.length
      });

      return {
        data: encrypted,
        iv,
        authTag,
        keyId,
        algorithm,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Encryption failed', { error, algorithm, keyId });
      throw error;
    }
  }

  /**
   * Decrypts encrypted data with integrity verification
   */
  public async decrypt(encryptedData: EncryptionResult): Promise<string> {
    try {
      // Get decryption key
      const key = await this.getEncryptionKey(encryptedData.keyId);

      // Create decipher
      const decipher = crypto.createDecipheriv(
        encryptedData.algorithm,
        key,
        encryptedData.iv,
        { authTagLength: EncryptionService.AUTH_TAG_LENGTH }
      );

      // Set auth tag for verification
      decipher.setAuthTag(encryptedData.authTag);

      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encryptedData.data),
        decipher.final()
      ]);

      this.logger.info('Data decrypted successfully', {
        algorithm: encryptedData.algorithm,
        keyId: encryptedData.keyId
      });

      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error('Decryption failed', {
        error,
        algorithm: encryptedData.algorithm,
        keyId: encryptedData.keyId
      });
      throw error;
    }
  }

  /**
   * Generates cryptographically secure hash using SHA-256 with salt
   */
  public generateHash(
    data: string,
    options: { salt?: Buffer } = {}
  ): string {
    try {
      const salt = options.salt || crypto.randomBytes(EncryptionService.SALT_LENGTH);
      const hash = crypto.createHash('sha256');
      
      // Combine salt and data
      hash.update(Buffer.concat([salt, Buffer.from(data)]));
      
      // Generate final hash
      const hashedData = hash.digest('hex');

      this.logger.info('Hash generated successfully', {
        dataLength: data.length
      });

      // Return combined salt and hash
      return `${salt.toString('hex')}:${hashedData}`;
    } catch (error) {
      this.logger.error('Hash generation failed', { error });
      throw error;
    }
  }

  /**
   * Handles KMS key rotation with cache update
   */
  public async rotateKey(keyId: string): Promise<void> {
    try {
      await this.kmsClient.scheduleKeyDeletion({
        KeyId: keyId,
        PendingWindowInDays: 7
      }).promise();

      // Clear key from cache
      this.keyCache.delete(keyId);

      this.logger.info('Key rotation scheduled', { keyId });
    } catch (error) {
      this.logger.error('Key rotation failed', { error, keyId });
      throw error;
    }
  }

  /**
   * Cleans up resources and cache
   */
  public destroy(): void {
    this.keyCache.clear();
    this.logger.destroy();
  }
}