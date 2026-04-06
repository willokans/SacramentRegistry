package com.wyloks.churchRegistry.web;

import com.wyloks.churchRegistry.dto.DioceseRequest;
import com.wyloks.churchRegistry.dto.DioceseResponse;
import com.wyloks.churchRegistry.dto.DioceseWithParishesResponse;
import com.wyloks.churchRegistry.dto.ParishResponse;
import com.wyloks.churchRegistry.service.DioceseService;
import com.wyloks.churchRegistry.service.ParishService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dioceses")
@RequiredArgsConstructor
public class DioceseController {

    private final DioceseService dioceseService;
    private final ParishService parishService;

    @GetMapping
    public List<DioceseResponse> getAll() {
        return dioceseService.findAll();
    }

    @GetMapping("/with-parishes")
    public List<DioceseWithParishesResponse> getDiocesesWithParishes() {
        return dioceseService.findDiocesesWithParishes();
    }

    @GetMapping("/search")
    public List<DioceseResponse> searchDioceses(
            @RequestParam("countryCode") String countryCode,
            @RequestParam(name = "q", required = false) String query
    ) {
        return dioceseService.searchByCountryAndQuery(countryCode, query);
    }

    @GetMapping("/{dioceseId}/parishes")
    public List<ParishResponse> getParishesByDiocese(@PathVariable Long dioceseId) {
        return parishService.findByDioceseId(dioceseId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<DioceseResponse> getById(@PathVariable Long id) {
        return dioceseService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<DioceseResponse> create(@Valid @RequestBody DioceseRequest request) {
        DioceseResponse created = dioceseService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
