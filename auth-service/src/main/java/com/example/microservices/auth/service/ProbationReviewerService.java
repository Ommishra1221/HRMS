package com.example.microservices.auth.service;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import com.example.microservices.auth.dto.ProbationReviewerResponse;
import com.example.microservices.auth.entity.User;
import com.example.microservices.auth.repository.UserRepository;
import com.example.microservices.auth.exception.UserNotFoundException;

@Service
@Transactional(readOnly=true)
@PreAuthorize("hasAnyRole('ADMIN','HR')")
public class ProbationReviewerService {
    public record ReviewerPage(List<ProbationReviewerResponse> content, long totalElements, int totalPages, int page, int size) {}
    private final UserRepository users;
    public ProbationReviewerService(UserRepository users) { this.users=users; }
    public ReviewerPage list(int page, int size, String search) {
        var result = users.findProbationReviewers(search, PageRequest.of(page,size,Sort.by("id")));
        return new ReviewerPage(result.map(this::map).getContent(),result.getTotalElements(),result.getTotalPages(),page,size);
    }
    public ProbationReviewerResponse get(Long id) {
        var user = users.findById(id).filter(u -> u.isEnabled() && u.getEmployeeId()!=null
            && u.getRoles().stream().anyMatch(r -> r.getName().equals("ROLE_EMPLOYEE")))
            .orElseThrow(() -> new UserNotFoundException("Eligible probation reviewer not found"));
        return map(user);
    }
    private ProbationReviewerResponse map(User u) { return new ProbationReviewerResponse(u.getId(),u.getUsername(),u.getFullName(),u.getEmployeeId()); }
}
