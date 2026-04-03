package com.wyloks.churchRegistry.repository;

import com.wyloks.churchRegistry.entity.UserInvitation;
import com.wyloks.churchRegistry.entity.UserInvitationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UserInvitationRepository extends JpaRepository<UserInvitation, Long> {

    Optional<UserInvitation> findByTokenHash(String tokenHash);

    List<UserInvitation> findByAppUserIdAndStatus(Long appUserId, UserInvitationStatus status);

    List<UserInvitation> findByStatusAndExpiresAtBefore(UserInvitationStatus status, Instant expiresAt);
}
