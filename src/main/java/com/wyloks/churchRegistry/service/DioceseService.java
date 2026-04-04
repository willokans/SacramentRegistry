package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.dto.DioceseRequest;
import com.wyloks.churchRegistry.dto.DioceseResponse;
import com.wyloks.churchRegistry.dto.DioceseWithParishesResponse;

import java.util.List;
import java.util.Optional;

public interface DioceseService {

    List<DioceseResponse> findAll();

    List<DioceseWithParishesResponse> findDiocesesWithParishes();

    List<DioceseResponse> searchByCountryAndQuery(String countryCode, String query);

    Optional<DioceseResponse> findById(Long id);

    DioceseResponse create(DioceseRequest request);
}
