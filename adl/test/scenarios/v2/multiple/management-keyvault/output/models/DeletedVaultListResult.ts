import { DeletedVault } from './DeletedVault';
/**
 * @description List of vaults
 */
export interface DeletedVaultListResult {
    /**
     * @description The list of deleted vaults.
     */
    value: Array<DeletedVault>;
    /**
     * @description The URL to get the next set of deleted vaults.
     */
    nextLink: string;
}