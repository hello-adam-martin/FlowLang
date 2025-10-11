"""
MongoDB Connection Plugin

Provides MongoDB NoSQL database connectivity with connection pooling,
built-in CRUD operations, and scaffolding commands.

Dependencies: motor>=3.3.0
"""
from typing import Any, Dict, List, Callable, Tuple, Optional
from ..base import ConnectionPlugin


class MongoDBPlugin(ConnectionPlugin):
    """
    MongoDB NoSQL database connection plugin.

    Features:
    - Async connection pooling with Motor
    - Built-in tasks: mongo_find, mongo_find_one, mongo_insert, mongo_update, mongo_delete
    - Aggregation pipeline support
    - Index management
    - Scaffolding commands for quick setup

    Example flow.yaml:
        connections:
          db:
            type: mongodb
            url: ${env.MONGODB_URL}
            database: ${env.MONGODB_DATABASE}
            max_pool_size: 100

        steps:
          - mongo_find:
              id: fetch_users
              connection: db
              collection: users
              filter: {active: true}
              limit: 100
              outputs:
                - documents
    """

    name = "mongodb"
    description = "MongoDB NoSQL database connection with Motor"
    version = "1.0.0"

    def __init__(self):
        """Initialize MongoDB plugin"""
        super().__init__()
        self._client = None
        self._database = None

    def get_config_schema(self) -> Dict[str, Any]:
        """Return JSON schema for MongoDB configuration"""
        return {
            "type": "object",
            "required": ["url", "database"],
            "properties": {
                "url": {
                    "type": "string",
                    "description": "MongoDB connection URL (mongodb://host:port or mongodb+srv://...)"
                },
                "database": {
                    "type": "string",
                    "description": "Database name"
                },
                "max_pool_size": {
                    "type": "integer",
                    "default": 100,
                    "minimum": 1,
                    "maximum": 1000,
                    "description": "Maximum number of connections in pool"
                },
                "min_pool_size": {
                    "type": "integer",
                    "default": 0,
                    "minimum": 0,
                    "description": "Minimum number of connections to maintain"
                },
                "server_selection_timeout_ms": {
                    "type": "integer",
                    "default": 30000,
                    "minimum": 1000,
                    "description": "Server selection timeout in milliseconds"
                },
                "connect_timeout_ms": {
                    "type": "integer",
                    "default": 20000,
                    "minimum": 1000,
                    "description": "Connection timeout in milliseconds"
                }
            }
        }

    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate MongoDB configuration"""
        required = ['url', 'database']
        for field in required:
            if field not in config:
                return False, f"Missing required field: {field}"

        url = config['url']
        if not (url.startswith('mongodb://') or url.startswith('mongodb+srv://')):
            return False, "URL must start with mongodb:// or mongodb+srv://"

        return True, None

    async def connect(self, config: Dict[str, Any]) -> Any:
        """
        Establish MongoDB connection.

        Args:
            config: Connection configuration

        Returns:
            Motor AsyncIOMotorDatabase instance

        Raises:
            ConnectionError: If connection fails
        """
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
        except ImportError:
            raise ImportError(
                "MongoDB plugin requires 'motor' package. "
                "Install with: pip install motor>=3.3.0"
            )

        self._config = config

        try:
            self._client = AsyncIOMotorClient(
                config['url'],
                maxPoolSize=config.get('max_pool_size', 100),
                minPoolSize=config.get('min_pool_size', 0),
                serverSelectionTimeoutMS=config.get('server_selection_timeout_ms', 30000),
                connectTimeoutMS=config.get('connect_timeout_ms', 20000)
            )

            # Get database
            self._database = self._client[config['database']]

            # Test connection
            await self._client.admin.command('ping')

            return self._database

        except Exception as e:
            raise ConnectionError(f"Failed to connect to MongoDB: {e}") from e

    async def disconnect(self):
        """Close MongoDB connection"""
        if self._client:
            self._client.close()
            self._client = None
            self._database = None

    async def get_connection(self) -> Any:
        """
        Get MongoDB database instance.

        Returns:
            Motor AsyncIOMotorDatabase instance
        """
        if not self._database:
            raise ConnectionError("MongoDB database not initialized")

        return self._database

    async def release_connection(self, connection: Any):
        """
        Release connection (no-op for MongoDB as pooling is internal).

        Args:
            connection: The database instance
        """
        # MongoDB handles connection pooling internally
        pass

    def get_builtin_tasks(self) -> Dict[str, Callable]:
        """
        Return built-in MongoDB tasks.

        These tasks provide zero-boilerplate database operations in YAML.
        """
        return {
            'mongo_find': self._task_find,
            'mongo_find_one': self._task_find_one,
            'mongo_insert': self._task_insert,
            'mongo_update': self._task_update,
            'mongo_delete': self._task_delete,
            'mongo_count': self._task_count,
            'mongo_aggregate': self._task_aggregate,
        }

    async def _task_find(
        self,
        collection: str,
        filter: Dict[str, Any] = None,
        projection: Dict[str, Any] = None,
        sort: List[Tuple[str, int]] = None,
        limit: int = 0,
        skip: int = 0,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Find documents matching filter.

        Args:
            collection: Collection name
            filter: Query filter (default: {})
            projection: Fields to include/exclude
            sort: Sort specification [(field, direction), ...]
            limit: Maximum documents to return (0 = no limit)
            skip: Number of documents to skip
            connection: Database instance (injected)

        Returns:
            Dict with 'documents' list

        Example YAML:
            - mongo_find:
                id: fetch_users
                connection: db
                collection: users
                filter: {active: true, age: {$gt: 18}}
                sort: [["name", 1]]
                limit: 100
                outputs:
                  - documents
        """
        try:
            coll = connection[collection]
            cursor = coll.find(filter or {}, projection=projection)

            if sort:
                cursor = cursor.sort(sort)

            if skip > 0:
                cursor = cursor.skip(skip)

            if limit > 0:
                cursor = cursor.limit(limit)

            documents = await cursor.to_list(length=None)

            # Convert ObjectId to string for JSON serialization
            for doc in documents:
                if '_id' in doc:
                    doc['_id'] = str(doc['_id'])

            return {'documents': documents, 'count': len(documents)}

        except Exception as e:
            raise FlowExecutionError(
                f"MongoDB find failed: {e}"
            ) from e

    async def _task_find_one(
        self,
        collection: str,
        filter: Dict[str, Any] = None,
        projection: Dict[str, Any] = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Find single document.

        Args:
            collection: Collection name
            filter: Query filter (default: {})
            projection: Fields to include/exclude
            connection: Database instance (injected)

        Returns:
            Dict with 'document' (None if not found)

        Example YAML:
            - mongo_find_one:
                id: fetch_user
                connection: db
                collection: users
                filter: {_id: "${inputs.user_id}"}
                outputs:
                  - document
        """
        try:
            coll = connection[collection]
            document = await coll.find_one(filter or {}, projection=projection)

            # Convert ObjectId to string
            if document and '_id' in document:
                document['_id'] = str(document['_id'])

            return {'document': document, 'found': document is not None}

        except Exception as e:
            raise FlowExecutionError(
                f"MongoDB find_one failed: {e}"
            ) from e

    async def _task_insert(
        self,
        collection: str,
        documents: List[Dict[str, Any]],
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Insert documents.

        Args:
            collection: Collection name
            documents: List of documents to insert (or single document)
            connection: Database instance (injected)

        Returns:
            Dict with 'inserted_ids' list

        Example YAML:
            - mongo_insert:
                id: create_user
                connection: db
                collection: users
                documents:
                  - name: "${inputs.name}"
                    email: "${inputs.email}"
                    active: true
                outputs:
                  - inserted_ids
        """
        try:
            coll = connection[collection]

            # Handle single document or list
            if isinstance(documents, dict):
                documents = [documents]

            if len(documents) == 1:
                result = await coll.insert_one(documents[0])
                inserted_ids = [str(result.inserted_id)]
            else:
                result = await coll.insert_many(documents)
                inserted_ids = [str(id) for id in result.inserted_ids]

            return {'inserted_ids': inserted_ids, 'count': len(inserted_ids)}

        except Exception as e:
            raise FlowExecutionError(
                f"MongoDB insert failed: {e}"
            ) from e

    async def _task_update(
        self,
        collection: str,
        filter: Dict[str, Any],
        update: Dict[str, Any],
        many: bool = False,
        upsert: bool = False,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Update documents.

        Args:
            collection: Collection name
            filter: Query filter
            update: Update operations (e.g., {$set: {...}})
            many: Update multiple documents (default: False)
            upsert: Insert if not found (default: False)
            connection: Database instance (injected)

        Returns:
            Dict with 'matched_count', 'modified_count', 'upserted_id'

        Example YAML:
            - mongo_update:
                id: update_user
                connection: db
                collection: users
                filter: {_id: "${inputs.user_id}"}
                update: {$set: {active: false}}
                outputs:
                  - modified_count
        """
        try:
            coll = connection[collection]

            if many:
                result = await coll.update_many(filter, update, upsert=upsert)
            else:
                result = await coll.update_one(filter, update, upsert=upsert)

            return {
                'matched_count': result.matched_count,
                'modified_count': result.modified_count,
                'upserted_id': str(result.upserted_id) if result.upserted_id else None
            }

        except Exception as e:
            raise FlowExecutionError(
                f"MongoDB update failed: {e}"
            ) from e

    async def _task_delete(
        self,
        collection: str,
        filter: Dict[str, Any],
        many: bool = False,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Delete documents.

        Args:
            collection: Collection name
            filter: Query filter
            many: Delete multiple documents (default: False)
            connection: Database instance (injected)

        Returns:
            Dict with 'deleted_count'

        Example YAML:
            - mongo_delete:
                id: delete_user
                connection: db
                collection: users
                filter: {_id: "${inputs.user_id}"}
                outputs:
                  - deleted_count
        """
        try:
            coll = connection[collection]

            if many:
                result = await coll.delete_many(filter)
            else:
                result = await coll.delete_one(filter)

            return {'deleted_count': result.deleted_count}

        except Exception as e:
            raise FlowExecutionError(
                f"MongoDB delete failed: {e}"
            ) from e

    async def _task_count(
        self,
        collection: str,
        filter: Dict[str, Any] = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Count documents.

        Args:
            collection: Collection name
            filter: Query filter (default: {})
            connection: Database instance (injected)

        Returns:
            Dict with 'count'

        Example YAML:
            - mongo_count:
                id: count_users
                connection: db
                collection: users
                filter: {active: true}
                outputs:
                  - count
        """
        try:
            coll = connection[collection]
            count = await coll.count_documents(filter or {})

            return {'count': count}

        except Exception as e:
            raise FlowExecutionError(
                f"MongoDB count failed: {e}"
            ) from e

    async def _task_aggregate(
        self,
        collection: str,
        pipeline: List[Dict[str, Any]],
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Run aggregation pipeline.

        Args:
            collection: Collection name
            pipeline: Aggregation pipeline stages
            connection: Database instance (injected)

        Returns:
            Dict with 'documents' list

        Example YAML:
            - mongo_aggregate:
                id: user_stats
                connection: db
                collection: users
                pipeline:
                  - {$match: {active: true}}
                  - {$group: {_id: "$country", count: {$sum: 1}}}
                  - {$sort: {count: -1}}
                outputs:
                  - documents
        """
        try:
            coll = connection[collection]
            cursor = coll.aggregate(pipeline)
            documents = await cursor.to_list(length=None)

            # Convert ObjectId to string
            for doc in documents:
                if '_id' in doc and hasattr(doc['_id'], '__str__'):
                    doc['_id'] = str(doc['_id'])

            return {'documents': documents, 'count': len(documents)}

        except Exception as e:
            raise FlowExecutionError(
                f"MongoDB aggregate failed: {e}"
            ) from e

    def get_dependencies(self) -> List[str]:
        """Return required pip packages"""
        return ["motor>=3.3.0"]

    def scaffold_connection_config(self, name: str = "db", **kwargs) -> str:
        """
        Generate MongoDB connection config YAML snippet.

        Args:
            name: Connection name
            **kwargs: Additional options (max_pool_size)

        Returns:
            YAML string
        """
        max_pool_size = kwargs.get('max_pool_size', 100)

        return f"""
  {name}:
    type: mongodb
    url: ${{env.MONGODB_URL}}
    database: ${{env.MONGODB_DATABASE}}
    max_pool_size: {max_pool_size}
"""

    def scaffold_example_flow(self, output_dir: str, connection_name: str = "db", **kwargs):
        """
        Generate example flow demonstrating MongoDB connection.

        Args:
            output_dir: Directory to write example
            connection_name: Connection name to use
        """
        import os

        example = f'''flow: MongoDBExample
description: Example flow using MongoDB connection

connections:
  {connection_name}:
    type: mongodb
    url: ${{env.MONGODB_URL}}
    database: ${{env.MONGODB_DATABASE}}
    max_pool_size: 100

inputs:
  - name: user_id
    type: string
    required: true

steps:
  # Find single document
  - mongo_find_one:
      id: fetch_user
      connection: {connection_name}
      collection: users
      filter: {{_id: "${{inputs.user_id}}"}}
      outputs:
        - document

  # Find multiple documents
  - mongo_find:
      id: fetch_posts
      connection: {connection_name}
      collection: posts
      filter: {{user_id: "${{inputs.user_id}}"}}
      sort: [["created_at", -1]]
      limit: 10
      outputs:
        - documents

  # Update document
  - mongo_update:
      id: update_user
      connection: {connection_name}
      collection: users
      filter: {{_id: "${{inputs.user_id}}"}}
      update: {{$set: {{last_seen: "${{now()}}"}}}}
      outputs:
        - modified_count

  # Count documents
  - mongo_count:
      id: count_posts
      connection: {connection_name}
      collection: posts
      filter: {{user_id: "${{inputs.user_id}}"}}
      outputs:
        - count

outputs:
  - name: user
    value: ${{fetch_user.document}}

  - name: posts
    value: ${{fetch_posts.documents}}

  - name: post_count
    value: ${{count_posts.count}}
'''

        os.makedirs(output_dir, exist_ok=True)
        example_path = os.path.join(output_dir, 'mongodb_example.yaml')

        with open(example_path, 'w') as f:
            f.write(example)

        print(f"Generated: {example_path}")


# Import FlowExecutionError for built-in tasks
try:
    from ...exceptions import FlowExecutionError, ConnectionError
except ImportError:
    # Fallback for when exceptions aren't available yet
    class FlowExecutionError(Exception):
        pass

    class ConnectionError(Exception):
        pass
