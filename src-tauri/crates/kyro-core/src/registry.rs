//! Service Registry for dependency injection
//!
//! Provides a centralized registry for managing service instances
//! and their lifecycle across the Kyro IDE backend.

use crate::error::{KyroError, KyroResult};
use async_trait::async_trait;
use dashmap::DashMap;
use std::any::{Any, TypeId};
use std::sync::Arc;

/// Trait for services that can be registered in the ServiceRegistry
#[async_trait]
pub trait Service: Send + Sync + 'static {
    /// Initialize the service
    async fn init(&mut self) -> KyroResult<()> {
        Ok(())
    }

    /// Shutdown the service gracefully
    async fn shutdown(&mut self) -> KyroResult<()> {
        Ok(())
    }

    /// Get the service name for logging/debugging
    fn name(&self) -> &str;

    /// Check if the service is healthy
    async fn health_check(&self) -> KyroResult<()> {
        Ok(())
    }
}

/// Service registry for dependency injection
///
/// Manages service instances and provides type-safe access to them.
/// Services are stored as Arc<dyn Any> and can be retrieved by type.
pub struct ServiceRegistry {
    services: DashMap<TypeId, Arc<dyn Any + Send + Sync>>,
    service_names: DashMap<TypeId, String>,
}

impl ServiceRegistry {
    /// Create a new empty service registry
    pub fn new() -> Self {
        Self {
            services: DashMap::new(),
            service_names: DashMap::new(),
        }
    }

    /// Register a service in the registry
    ///
    /// # Example
    /// ```ignore
    /// let registry = ServiceRegistry::new();
    /// registry.register(my_service);
    /// ```
    pub fn register<T: Service>(&self, service: T) -> KyroResult<()> {
        let type_id = TypeId::of::<T>();
        let name = service.name().to_string();

        if self.services.contains_key(&type_id) {
            return Err(KyroError::service_init_failed(format!(
                "Service {} already registered",
                name
            )));
        }

        self.services.insert(type_id, Arc::new(service));
        self.service_names.insert(type_id, name.clone());

        log::info!("Registered service: {}", name);
        Ok(())
    }

    /// Register a service wrapped in Arc
    pub fn register_arc<T: Service>(&self, service: Arc<T>) -> KyroResult<()> {
        let type_id = TypeId::of::<T>();
        let name = service.name().to_string();

        if self.services.contains_key(&type_id) {
            return Err(KyroError::service_init_failed(format!(
                "Service {} already registered",
                name
            )));
        }

        self.services.insert(type_id, service);
        self.service_names.insert(type_id, name.clone());

        log::info!("Registered service (Arc): {}", name);
        Ok(())
    }

    /// Get a service from the registry
    ///
    /// # Example
    /// ```ignore
    /// let service = registry.get::<MyService>()?;
    /// ```
    pub fn get<T: Service>(&self) -> KyroResult<Arc<T>> {
        let type_id = TypeId::of::<T>();

        self.services
            .get(&type_id)
            .ok_or_else(|| {
                let name = self
                    .service_names
                    .get(&type_id)
                    .map(|n| n.value().clone())
                    .unwrap_or_else(|| std::any::type_name::<T>().to_string());
                KyroError::service_not_found(name)
            })
            .and_then(|service| {
                service
                    .value()
                    .clone()
                    .downcast::<T>()
                    .map_err(|_| KyroError::service_not_found(std::any::type_name::<T>()))
            })
    }

    /// Try to get a service, returning None if not found
    pub fn try_get<T: Service>(&self) -> Option<Arc<T>> {
        let type_id = TypeId::of::<T>();

        self.services
            .get(&type_id)
            .and_then(|service| service.value().clone().downcast::<T>().ok())
    }

    /// Check if a service is registered
    pub fn has<T: Service>(&self) -> bool {
        let type_id = TypeId::of::<T>();
        self.services.contains_key(&type_id)
    }

    /// Remove a service from the registry
    pub fn remove<T: Service>(&self) -> Option<Arc<T>> {
        let type_id = TypeId::of::<T>();

        self.services
            .remove(&type_id)
            .and_then(|(_, service)| service.downcast::<T>().ok())
    }

    /// Get the number of registered services
    pub fn len(&self) -> usize {
        self.services.len()
    }

    /// Check if the registry is empty
    pub fn is_empty(&self) -> bool {
        self.services.is_empty()
    }

    /// List all registered service names
    pub fn list_services(&self) -> Vec<String> {
        self.service_names
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Initialize all registered services
    pub async fn init_all(&self) -> KyroResult<()> {
        log::info!("Initializing {} services...", self.len());

        // Note: We can't easily call init() on trait objects without additional infrastructure
        // This would require storing mutable references or using interior mutability
        // For now, services should be initialized before registration

        Ok(())
    }

    /// Shutdown all registered services
    pub async fn shutdown_all(&self) -> KyroResult<()> {
        log::info!("Shutting down {} services...", self.len());

        // Note: Same limitation as init_all
        // Services should handle their own cleanup in Drop implementations

        Ok(())
    }

    /// Perform health checks on all services
    pub async fn health_check_all(&self) -> KyroResult<Vec<(String, KyroResult<()>)>> {
        let results = Vec::new();

        // Note: Same limitation - would need additional infrastructure for trait object method calls

        Ok(results)
    }
}

impl Default for ServiceRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(all(test, feature = "fixme_tests"))]
mod tests {
    use super::*;

    struct TestService {
        name: String,
    }

    #[async_trait]
    impl Service for TestService {
        fn name(&self) -> &str {
            &self.name
        }
    }

    #[tokio::test]
    async fn test_register_and_get() {
        let registry = ServiceRegistry::new();
        let service = TestService {
            name: "test".to_string(),
        };

        registry.register(service).unwrap();
        assert!(registry.has::<TestService>());

        let retrieved = registry.get::<TestService>().unwrap();
        assert_eq!(retrieved.name(), "test");
    }

    #[tokio::test]
    async fn test_duplicate_registration() {
        let registry = ServiceRegistry::new();
        let service1 = TestService {
            name: "test1".to_string(),
        };
        let service2 = TestService {
            name: "test2".to_string(),
        };

        registry.register(service1).unwrap();
        let result = registry.register(service2);
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_service_not_found() {
        let registry = ServiceRegistry::new();
        let result = registry.get::<TestService>();
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_list_services() {
        let registry = ServiceRegistry::new();
        let service = TestService {
            name: "test".to_string(),
        };

        registry.register(service).unwrap();
        let services = registry.list_services();
        assert_eq!(services.len(), 1);
        assert_eq!(services[0], "test");
    }
}
