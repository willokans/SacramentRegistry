package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.dto.ReplaceUserParishAccessRequest;
import com.wyloks.churchRegistry.dto.UserParishAccessResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface UserParishAccessService {

    List<UserParishAccessResponse> listAllUsersWithParishAccess();

    Page<UserParishAccessResponse> searchUsersWithParishAccess(String query, Pageable pageable);

    UserParishAccessResponse getUserParishAccess(Long userId);

    UserParishAccessResponse replaceUserParishAccess(Long userId, ReplaceUserParishAccessRequest request);
}
