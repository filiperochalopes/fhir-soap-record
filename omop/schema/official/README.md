# Pinned OHDSI DDL

These files are byte-for-byte copies of the PostgreSQL scripts published by
OHDSI/CommonDataModel at tag `v5.4.2`:

https://github.com/OHDSI/CommonDataModel/tree/v5.4.2/inst/ddl/5.4/postgresql

SHA-256:

```text
dedae8072ef585e25e0ab2624f557e37e5ddd2d51e75810af58b02e990a4f293  OMOPCDM_postgresql_5.4_constraints.sql
5951df2403299232b2c430b1d88e78ef49108a00cb29b44f2edccd2643420b21  OMOPCDM_postgresql_5.4_ddl.sql
8a3537f971c75e9e33c3d1d13b041d4e5de8532dc1607bc31349af3679a66eec  OMOPCDM_postgresql_5.4_indices.sql
ffe6cc10f04a713ea86825dccfc1d8b8a981ba6037fc69cb9df4c80ce2f1970d  OMOPCDM_postgresql_5.4_primary_keys.sql
```

The initialization script replaces only the official
`@cdmDatabaseSchema` placeholder while streaming the files to PostgreSQL.
