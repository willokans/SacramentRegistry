package com.wyloks.churchRegistry.config;

import com.wyloks.churchRegistry.security.RlsSessionContext;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.datasource.DelegatingDataSource;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Wraps the DataSource to set PostgreSQL session variables {@code app.parish_ids} and {@code app.is_admin}
 * for RLS policies when a connection is obtained. {@code app.is_admin} is {@code true} only for
 * {@code SUPER_ADMIN}; parish {@code ADMIN} relies on {@code app.parish_ids} only. Only active when RLS is enabled.
 * Creates an explicit raw DataSource to avoid circular reference with Liquibase/JPA.
 * Ensures PgBouncer-compatible URL params (preferQueryMode=simple, prepareThreshold=0).
 */
@Configuration
@Profile("!auth-slice")
@ConditionalOnProperty(name = "app.rls.enabled", havingValue = "true", matchIfMissing = false)
public class RlsDataSourceConfig {

    private static final String PG_BOUNCER_PARAMS = "preferQueryMode=simple&prepareThreshold=0";

    @Bean("rawDataSource")
    public DataSource rawDataSource(DataSourceProperties properties) {
        var builder = properties.initializeDataSourceBuilder();
        String url = properties.getUrl();
        if (url != null && url.contains("postgresql") && !url.contains("preferQueryMode")) {
            url = url + (url.contains("?") ? "&" : "?") + PG_BOUNCER_PARAMS;
            builder.url(url);
        }
        return builder.build();
    }

    @Bean
    @Primary
    public DataSource rlsDataSource(DataSource rawDataSource) {
        return new RlsAwareDataSource(rawDataSource);
    }

    /**
     * DataSource that sets RLS session variables when a connection is obtained.
     */
    private static final class RlsAwareDataSource extends DelegatingDataSource {

        RlsAwareDataSource(DataSource targetDataSource) {
            super(targetDataSource);
        }

        @Override
        public Connection getConnection() throws SQLException {
            Connection conn = getTargetDataSource().getConnection();
            applyRlsSessionVars(conn);
            return conn;
        }

        @Override
        public Connection getConnection(String username, String password) throws SQLException {
            Connection conn = getTargetDataSource().getConnection(username, password);
            applyRlsSessionVars(conn);
            return conn;
        }

        private void applyRlsSessionVars(Connection conn) throws SQLException {
            RlsSessionContext.RlsValues values = RlsSessionContext.get();
            String parishIds = values.parishIdsAsCommaSeparated();
            String isAdmin = values.isAdmin() ? "true" : "false";
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("SET LOCAL app.parish_ids = '" + parishIds.replace("'", "''") + "'");
                stmt.execute("SET LOCAL app.is_admin = '" + isAdmin + "'");
            }
        }
    }
}
