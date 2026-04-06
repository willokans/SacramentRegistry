package com.wyloks.churchRegistry.security;

import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Parish;

import java.util.HashSet;
import java.util.Set;

/**
 * Parish overlap for scoped {@code ADMIN} (mutual visibility, invitation scope, etc.).
 */
public final class ParishAccessPolicy {

    private ParishAccessPolicy() {
    }

    public static Set<Long> effectiveParishIds(AppUser user) {
        Set<Long> ids = new HashSet<>();
        if (user.getParishAccesses() != null) {
            for (Parish p : user.getParishAccesses()) {
                if (p != null && p.getId() != null) {
                    ids.add(p.getId());
                }
            }
        }
        if (user.getParish() != null && user.getParish().getId() != null) {
            ids.add(user.getParish().getId());
        }
        return ids;
    }

    public static boolean sharesParishWithActor(Set<Long> actorParishIds, AppUser targetUser) {
        if (actorParishIds == null || actorParishIds.isEmpty()) {
            return false;
        }
        return effectiveParishIds(targetUser).stream().anyMatch(actorParishIds::contains);
    }
}
