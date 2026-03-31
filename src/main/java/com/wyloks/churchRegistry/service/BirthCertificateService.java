package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.dto.BaptismDocumentVersionResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface BirthCertificateService {

    BaptismDocumentVersionResponse upload(Long baptismId, MultipartFile file);

    RemoteFileService.RemoteFile downloadCurrent(Long baptismId);

    List<BaptismDocumentVersionResponse> listVersions(Long baptismId);

    RemoteFileService.RemoteFile downloadVersion(Long baptismId, Long versionId);
}
