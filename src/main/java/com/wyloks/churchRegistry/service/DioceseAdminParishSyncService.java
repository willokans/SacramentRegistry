package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.entity.AppUser;

import java.util.Set;

/**
 * Keeps {@link AppUser#getParishAccesses()} aligned with assigned dioceses for {@code DIOCESE_ADMIN} users
 * so RLS and parish-scoped authorization continue to use parish ID sets only.
 */
public interface DioceseAdminParishSyncService {

    /**
     * Replaces the user's diocese assignments and repopulates parish access with every parish in those dioceses.
     */
    void assignDiocesesAndSyncParishes(AppUser user, Set<Long> dioceseIds);

    void clearDioceseAccess(AppUser user);

    /**
     * After a new parish is created in a diocese, expand parish access for all diocese admins of that diocese.
     */
    void refreshParishAccessForDioceseAdmins(Long dioceseId);

    /**
     * If the current default parish is still in {@link AppUser#getParishAccesses()}, leave it; otherwise pick one
     * parish when there is exactly one, else clear default.
     */
    void resolveDefaultParishAfterParishSync(AppUser user);
}
