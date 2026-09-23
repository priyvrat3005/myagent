"""
SecretsVault - Encrypted secrets storage with swappable backend.

The method signatures are designed so that swapping from the database-backed
Fernet implementation to HashiCorp Vault requires no caller changes.

Usage:
    vault = SecretsVault()
    await vault.set_secret(org_id, "API_KEY", "sk-...")
    value = await vault.get_secret(org_id, "API_KEY")
    await vault.delete_secret(org_id, "API_KEY")
"""
from typing import Optional, Protocol
from cryptography.fernet import Fernet
import os
import base64


# TODO: Move encryption key to environment variable / KMS
_ENCRYPTION_KEY = base64.urlsafe_b64encode(os.urandom(32))
_fernet = Fernet(_ENCRYPTION_KEY)


class SecretsVaultInterface(Protocol):
    """
    Interface for secrets storage.
    
    Any implementation (DB-backed, HashiCorp Vault, AWS Secrets Manager)
    must implement these exact method signatures.
    """
    
    async def get_secret(self, org_id: str, key_name: str) -> Optional[str]:
        """Retrieve a decrypted secret value. Returns None if not found."""
        ...
    
    async def set_secret(self, org_id: str, key_name: str, value: str) -> None:
        """Store an encrypted secret value."""
        ...
    
    async def delete_secret(self, org_id: str, key_name: str) -> bool:
        """Delete a secret. Returns True if it existed."""
        ...
    
    async def list_secrets(self, org_id: str) -> list[str]:
        """List all secret key names for an org (never returns values)."""
        ...


class SecretsVault:
    """
    Database-backed secrets vault using Fernet encryption at rest.
    
    In production, swap this for HashiCorpVault by implementing
    the same SecretsVaultInterface protocol.
    """
    
    def __init__(self, db_session=None):
        self._db = db_session
        self._cache: dict[str, dict[str, str]] = {}  # In-memory fallback for dev
    
    async def get_secret(self, org_id: str, key_name: str) -> Optional[str]:
        """Retrieve and decrypt a secret."""
        if self._db:
            # TODO: Query from secrets table
            # result = await self._db.execute(
            #     select(Secret).where(Secret.org_id == org_id, Secret.key_name == key_name)
            # )
            # secret = result.scalar_one_or_none()
            # if secret:
            #     return _fernet.decrypt(secret.encrypted_value.encode()).decode()
            pass
        
        # In-memory fallback
        org_secrets = self._cache.get(org_id, {})
        encrypted = org_secrets.get(key_name)
        if encrypted:
            return _fernet.decrypt(encrypted.encode()).decode()
        return None
    
    async def set_secret(self, org_id: str, key_name: str, value: str) -> None:
        """Encrypt and store a secret."""
        encrypted = _fernet.encrypt(value.encode()).decode()
        
        if self._db:
            # TODO: Upsert into secrets table
            pass
        
        # In-memory fallback
        if org_id not in self._cache:
            self._cache[org_id] = {}
        self._cache[org_id][key_name] = encrypted
    
    async def delete_secret(self, org_id: str, key_name: str) -> bool:
        """Delete a secret."""
        if self._db:
            # TODO: Delete from secrets table
            pass
        
        org_secrets = self._cache.get(org_id, {})
        if key_name in org_secrets:
            del org_secrets[key_name]
            return True
        return False
    
    async def list_secrets(self, org_id: str) -> list[str]:
        """List secret keys (never values)."""
        if self._db:
            # TODO: Query key names from secrets table
            pass
        
        return list(self._cache.get(org_id, {}).keys())


# TODO: HashiCorp Vault implementation (swap-in ready)
class HashiCorpVault:
    """
    HashiCorp Vault implementation of SecretsVaultInterface.
    
    TODO: Implement when ready to swap from DB-backed storage.
    Method signatures match SecretsVaultInterface exactly.
    """
    
    def __init__(self, vault_url: str, vault_token: str, mount_path: str = "secret"):
        self.vault_url = vault_url
        self.vault_token = vault_token
        self.mount_path = mount_path
        # TODO: self.client = hvac.Client(url=vault_url, token=vault_token)
    
    async def get_secret(self, org_id: str, key_name: str) -> Optional[str]:
        path = f"{self.mount_path}/data/orgs/{org_id}/{key_name}"
        # TODO: response = self.client.secrets.kv.v2.read_secret_version(path=path)
        # return response["data"]["data"]["value"]
        raise NotImplementedError("HashiCorp Vault - implement when swapping from DB")
    
    async def set_secret(self, org_id: str, key_name: str, value: str) -> None:
        path = f"{self.mount_path}/data/orgs/{org_id}/{key_name}"
        # TODO: self.client.secrets.kv.v2.create_or_update_secret(path=path, secret={"value": value})
        raise NotImplementedError("HashiCorp Vault - implement when swapping from DB")
    
    async def delete_secret(self, org_id: str, key_name: str) -> bool:
        path = f"{self.mount_path}/data/orgs/{org_id}/{key_name}"
        # TODO: self.client.secrets.kv.v2.delete_metadata_and_all_versions(path=path)
        raise NotImplementedError("HashiCorp Vault - implement when swapping from DB")
    
    async def list_secrets(self, org_id: str) -> list[str]:
        path = f"{self.mount_path}/metadata/orgs/{org_id}"
        # TODO: response = self.client.secrets.kv.v2.list_secrets(path=path)
        # return response["data"]["keys"]
        raise NotImplementedError("HashiCorp Vault - implement when swapping from DB")
